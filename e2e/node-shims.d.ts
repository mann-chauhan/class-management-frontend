declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }

  interface Process {
    env: ProcessEnv;
    cwd(): string;
    kill(pid: number, signal?: string): void;
  }
}

declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: 'utf8'): Promise<string>;
  export function appendFile(path: string, data: string, encoding: 'utf8'): Promise<void>;
  export function writeFile(path: string, data: string, options?: Record<string, unknown>): Promise<void>;
  export function chmod(path: string, mode: number): Promise<void>;
  export function rm(path: string, options?: Record<string, unknown>): Promise<void>;
}

declare module 'node:child_process' {
  export interface ChildProcess {
    pid?: number;
    exitCode: number | null;
  }
  export function spawn(file: string, args: string[], options: Record<string, unknown>): ChildProcess;
  export function execFileSync(file: string, args: string[], options: Record<string, unknown>): unknown;
  export function execFile(
    file: string,
    args: string[],
    options: Record<string, unknown>,
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ): void;
}

declare module 'node:util' {
  export function promisify(fn: (...args: any[]) => void): (...args: any[]) => Promise<{ stdout: string; stderr: string }>;
}

declare module 'node:crypto' {
  export function randomBytes(size: number): { toString(encoding: string): string };
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
}

declare module 'node:os' {
  export function tmpdir(): string;
}
