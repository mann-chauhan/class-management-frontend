import { execFileSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stopOwnedBackend, type BackendProcessState } from './global-setup';

const nodeProcess = (globalThis as typeof globalThis & { process: NodeJS.Process }).process;
const backendRoot = resolve(nodeProcess.cwd(), '../class-management-system');
const fixtureScript = join(backendRoot, 'scripts/admin-password-reset-browser-fixtures.sh');

export default async function globalTeardown(): Promise<void> {
  const statePath = nodeProcess.env.ADMIN_PASSWORD_RESET_STATE_FILE;
  if (!statePath) return;
  const state = JSON.parse(await readFile(statePath, 'utf8')) as BackendProcessState;
  const env: Record<string, string | undefined> = { ...nodeProcess.env, ADMIN_PASSWORD_RESET_RUN_MARKER: state.marker };
  delete env.DB_URL;
  delete env.DATABASE_URL;
  delete env.SPRING_DATASOURCE_URL;
  delete env.ADMIN_PASSWORD_RESET_INITIAL_PASSWORD;
  delete env.ADMIN_PASSWORD_RESET_BCRYPT_HASH_FILE;
  delete env.JWT_SECRET;
  let shutdownError: unknown;
  try {
    await stopOwnedBackend(state);
  } catch (error) {
    shutdownError = error;
  }
  if (shutdownError) {
    throw new Error('Admin password-reset backend shutdown failed for the recorded process group; '
      + 'fixture cleanup was not attempted and manifest, audit, and recovery evidence were preserved');
  }

  try {
    execFileSync('bash', [fixtureScript, 'cleanup'], { cwd: backendRoot, env, stdio: 'ignore' });
  } catch {
    throw new Error('Admin password-reset cleanup failed after backend shutdown; recovery evidence was preserved');
  }
  await rm(statePath, { force: true });
}
