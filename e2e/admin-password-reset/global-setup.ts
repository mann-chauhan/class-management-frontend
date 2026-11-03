import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { FullConfig } from '@playwright/test';

const nodeProcess = (globalThis as typeof globalThis & { process: NodeJS.Process }).process;
const processController = nodeProcess as NodeJS.Process & { kill(pid: number, signal?: string | number): void };
const frontendRoot = resolve(nodeProcess.cwd());
const backendRoot = resolve(frontendRoot, '../class-management-system');
const fixtureScript = join(backendRoot, 'scripts/admin-password-reset-browser-fixtures.sh');
const backendScript = join(backendRoot, 'scripts/run-leave-browser-backend.sh');
const dbUrl = 'jdbc:postgresql://localhost:5432/cms_leave_test';
const stateFile = join(tmpdir(), 'cms-admin-password-reset-' + randomBytes(8).toString('hex') + '.state');
const processGroupTermTimeoutMs = 5_000;
const processGroupKillTimeoutMs = 5_000;
const processGroupPollMs = 100;

export interface BackendProcessState {
  marker: string;
  pid: number;
  processGroupId: number;
}

function required(name: string): string {
  const value = nodeProcess.env[name];
  if (!value) throw new Error('Missing isolated Admin password-reset input: ' + name);
  return value;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function processGroupIsAlive(processGroupId: number): boolean {
  try {
    processController.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if (errorCode(error) === 'ESRCH') return false;
    if (errorCode(error) === 'EPERM') return true;
    throw error;
  }
}

async function waitForProcessGroupExit(processGroupId: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processGroupIsAlive(processGroupId)) return true;
    await new Promise(resolveDelay => setTimeout(resolveDelay, processGroupPollMs));
  }
  return !processGroupIsAlive(processGroupId);
}

export async function stopOwnedBackend(state: BackendProcessState): Promise<void> {
  if (!Number.isSafeInteger(state.pid) || state.pid <= 1
    || !Number.isSafeInteger(state.processGroupId) || state.processGroupId <= 1
    || state.pid !== state.processGroupId) {
    throw new Error('Admin password-reset backend state did not contain a valid owned process group');
  }

  if (!processGroupIsAlive(state.processGroupId)) return;
  try {
    processController.kill(-state.processGroupId, 'SIGTERM');
  } catch (error) {
    if (errorCode(error) === 'ESRCH') return;
    throw new Error('Admin password-reset backend process group could not be signalled for shutdown');
  }
  if (await waitForProcessGroupExit(state.processGroupId, processGroupTermTimeoutMs)) return;

  try {
    processController.kill(-state.processGroupId, 'SIGKILL');
  } catch (error) {
    if (errorCode(error) === 'ESRCH') return;
    throw new Error('Admin password-reset backend process group did not stop after graceful shutdown');
  }
  if (!(await waitForProcessGroupExit(state.processGroupId, processGroupKillTimeoutMs))) {
    throw new Error('Admin password-reset backend process group did not terminate after escalation');
  }
}

function validateEnvironment(): void {
  if (nodeProcess.env.DB_URL || nodeProcess.env.DATABASE_URL || nodeProcess.env.SPRING_DATASOURCE_URL) {
    throw new Error('Admin password-reset E2E refuses datasource overrides');
  }
  if (Object.keys(nodeProcess.env).some(name => name.startsWith('LEAVE_BROWSER_'))) {
    throw new Error('Admin password-reset E2E refuses inherited Leave-browser variables');
  }
  if (required('ADMIN_PASSWORD_RESET_DB_URL') !== dbUrl) {
    throw new Error('Admin password-reset E2E requires the exact cms_leave_test JDBC URL');
  }
  for (const name of [
    'ADMIN_PASSWORD_RESET_INITIAL_PASSWORD',
    'ADMIN_PASSWORD_RESET_BCRYPT_HASH_FILE',
    'TEST_DB_USERNAME',
    'TEST_DB_PASSWORD',
    'JWT_SECRET',
    'PGPASSFILE',
  ]) required(name);
}

function runFixture(operation: 'setup' | 'cleanup', marker: string): void {
  const env: Record<string, string | undefined> = { ...nodeProcess.env, ADMIN_PASSWORD_RESET_RUN_MARKER: marker };
  delete env.DB_URL;
  delete env.DATABASE_URL;
  delete env.SPRING_DATASOURCE_URL;
  execFileSync('bash', [fixtureScript, operation], { cwd: backendRoot, env, stdio: 'ignore' });
}

async function waitForBackend(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Isolated Admin password-reset backend exited during startup');
    try {
      const response = await fetch('http://localhost:18080/api/v1/browser-test/identity');
      if (response.ok) {
        const body = await response.json() as { database?: string; port?: number; address?: string };
        if (body.database === 'cms_leave_test' && body.port === 5432
          && ['127.0.0.1', '::1'].includes(body.address ?? '')) return;
      }
    } catch {
      // The isolated backend is still starting.
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 500));
  }
  throw new Error('Timed out waiting for the isolated Admin password-reset backend');
}

function idsFromManifest(source: string, marker: string): { active: string; inactive: string } {
  let active = '';
  let inactive = '';
  for (const line of source.split('\n')) {
    const parts = line.split('|');
    if (parts[0] !== 'fixture' || parts[1] !== marker || parts[2] !== 'admin') continue;
    if (parts[6] === 'true') active = parts[3];
    if (parts[6] === 'false') inactive = parts[3];
  }
  if (!active || !inactive) throw new Error('Admin password-reset manifest did not contain both Admin IDs');
  return { active, inactive };
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  validateEnvironment();
  for (const project of config.projects) {
    if (project.use.baseURL !== 'http://localhost:14200') {
      throw new Error('Admin password-reset Playwright baseURL must be http://localhost:14200');
    }
  }
  const marker = 'admin-reset-' + randomBytes(8).toString('hex');
  const manifest = join(backendRoot, '.admin-password-reset-browser-manifests', marker + '.manifest');
  let backend: ChildProcess | undefined;
  let startedState: BackendProcessState | undefined;
  try {
    runFixture('setup', marker);
    const manifestSource = await readFile(manifest, 'utf8');
    const ids = idsFromManifest(manifestSource, marker);
    nodeProcess.env.ADMIN_PASSWORD_RESET_RUN_MARKER = marker;
    nodeProcess.env.ADMIN_PASSWORD_RESET_ACTIVE_ADMIN_ID = ids.active;
    nodeProcess.env.ADMIN_PASSWORD_RESET_INACTIVE_ADMIN_ID = ids.inactive;
    nodeProcess.env.ADMIN_PASSWORD_RESET_STATE_FILE = stateFile;
    const backendEnv: Record<string, string | undefined> = { ...nodeProcess.env, BROWSER_TEST_PORT: '18080', BROWSER_TEST_FRONTEND_URL: 'http://localhost:14200' };
    delete backendEnv.DB_URL;
    delete backendEnv.DATABASE_URL;
    delete backendEnv.SPRING_DATASOURCE_URL;
    delete backendEnv.ADMIN_PASSWORD_RESET_INITIAL_PASSWORD;
    delete backendEnv.ADMIN_PASSWORD_RESET_BCRYPT_HASH_FILE;
    delete backendEnv.ADMIN_PASSWORD_RESET_DB_URL;
    delete backendEnv.PGPASSFILE;
    backend = spawn('bash', [backendScript], {
      cwd: backendRoot,
      env: backendEnv,
      stdio: 'ignore',
      detached: true,
    });
    if (!backend.pid || backend.pid <= 1) {
      throw new Error('Admin password-reset backend did not expose an owned process-group leader');
    }
    startedState = { marker, pid: backend.pid, processGroupId: backend.pid };
    await writeFile(stateFile, JSON.stringify(startedState) + '\n', { mode: 0o600 });
    await chmod(stateFile, 0o600);
    await waitForBackend(backend);
  } catch (error) {
    let shutdownError: unknown;
    let cleanupError: unknown;
    if (startedState) {
      try {
        await stopOwnedBackend(startedState);
      } catch (stopError) {
        shutdownError = stopError;
      }
    }
    if (!shutdownError) {
      try {
        runFixture('cleanup', marker);
      } catch (cleanupFailure) {
        cleanupError = cleanupFailure;
      }
    }
    if (shutdownError || cleanupError) {
      const reason = shutdownError
        ? 'backend shutdown failed; fixture cleanup was not attempted'
        : 'fixture cleanup failed after backend shutdown';
      throw new Error('Admin password-reset setup failed: ' + reason
        + '; manifest, audit, and any recovery evidence were preserved');
    }
    throw error;
  }
}
