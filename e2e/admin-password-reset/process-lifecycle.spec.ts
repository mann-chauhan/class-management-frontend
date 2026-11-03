import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stopOwnedBackend, type BackendProcessState } from './global-setup';

const state: BackendProcessState = {
  marker: 'offline-test-marker',
  pid: 4321,
  processGroupId: 4321,
};
const nodeProcess = (globalThis as typeof globalThis & { process: NodeJS.Process }).process;
const processController = nodeProcess as NodeJS.Process & { kill(pid: number, signal?: string | number): void };

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Admin password-reset backend lifecycle', () => {
  it('uses a detached process group and stops it before teardown cleanup', async () => {
    const setupSource = await readFile(decodeURIComponent(new URL('./global-setup.ts', import.meta.url).pathname), 'utf8');
    const teardownSource = await readFile(decodeURIComponent(new URL('./global-teardown.ts', import.meta.url).pathname), 'utf8');

    expect(setupSource).toContain('detached: true');
    expect(setupSource).toContain('processGroupId: backend.pid');
    expect(teardownSource.indexOf('await stopOwnedBackend(state)'))
      .toBeLessThan(teardownSource.indexOf("execFileSync('bash', [fixtureScript, 'cleanup']"));
    expect(teardownSource).not.toContain('nodeProcess.kill(state.pid');
  });

  it('performs graceful shutdown and escalates only the recorded process group', async () => {
    let alive = true;
    const calls: Array<[number, string | number | undefined]> = [];
    vi.spyOn(processController, 'kill').mockImplementation((pid: number, signal?: string | number) => {
      calls.push([pid, signal]);
      if (signal === 'SIGTERM') alive = false;
      if (signal === 0 && !alive) {
        const error = Object.assign(new Error('gone'), { code: 'ESRCH' });
        throw error;
      }
      return undefined;
    });

    await stopOwnedBackend(state);

    expect(calls).toEqual([
      [-4321, 0],
      [-4321, 'SIGTERM'],
      [-4321, 0],
    ]);

    alive = true;
    calls.length = 0;
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.spyOn(processController, 'kill').mockImplementation((pid: number, signal?: string | number) => {
      calls.push([pid, signal]);
      if (signal === 'SIGKILL') alive = false;
      if (signal === 0 && !alive) {
        const error = Object.assign(new Error('gone'), { code: 'ESRCH' });
        throw error;
      }
      return undefined;
    });

    const shutdown = stopOwnedBackend(state);
    await vi.advanceTimersByTimeAsync(5_000);
    await shutdown;

    expect(calls).toContainEqual([-4321, 'SIGTERM']);
    expect(calls).toContainEqual([-4321, 'SIGKILL']);
    expect(calls.every(([pid]) => pid === -4321)).toBe(true);
  });

  it('stops a started backend before setup failure cleanup and preserves failure paths', async () => {
    const setupSource = await readFile(decodeURIComponent(new URL('./global-setup.ts', import.meta.url).pathname), 'utf8');
    const catchStart = setupSource.lastIndexOf('  } catch (error) {');
    const catchEnd = setupSource.indexOf('\n  }\n}', catchStart);
    const catchSource = setupSource.slice(catchStart, catchEnd);

    expect(setupSource).toContain('let startedState: BackendProcessState | undefined;');
    expect(catchSource.indexOf('await stopOwnedBackend(startedState)'))
      .toBeLessThan(catchSource.indexOf("runFixture('cleanup', marker)"));
    expect(catchSource).toContain('backend shutdown failed; fixture cleanup was not attempted');
    expect(catchSource).toContain('manifest, audit, and any recovery evidence were preserved');
  });
});
