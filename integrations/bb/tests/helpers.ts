import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { vi } from 'vitest';
import type { HighwaterServer } from '../host/http';
import manifest from '../package.json';

export const expectedVersion = manifest.version;

/**
 * Fake timers that still follow real time, so `waitFor` works, and a function that moves
 * them on by the refresh scheduler's two-second gap instead of waiting for it. The gap
 * itself is tested in scheduler.test.ts. Call `vi.useRealTimers()` after each test.
 */
export function skippableTimers(): (ms?: number) => Promise<void> {
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'],
  });
  return async (ms = 2000) => {
    await vi.advanceTimersByTimeAsync(ms);
  };
}

export const repository = resolve(import.meta.dirname, '../../..');
const binaryName = process.platform === 'win32' ? 'highwater.exe' : 'highwater';
export const binaries = process.env.HIGHWATER_TEST_BINARIES?.split(',') ?? [
  join(repository, 'target/debug', binaryName),
  join(repository, 'target/release', binaryName),
];
export async function tempDirectory(): Promise<string> {
  await mkdir(join(repository, 'target'), { recursive: true });
  return mkdtemp(join(repository, 'target/bb-plugin-test-'));
}
export async function writePi(
  home: string,
  name = 'probe-main',
  malformed = false,
): Promise<string> {
  const path = join(home, '.bb/pi-bridge-sessions', `${name}.jsonl`);
  await mkdir(dirname(path), { recursive: true });
  const lines = (
    await readFile(
      join(
        repository,
        malformed ? 'fixtures/pi/malformed-parent.jsonl' : 'fixtures/pi/simple.jsonl',
      ),
      'utf8',
    )
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  lines[0].id = name;
  lines[0].cwd = home;
  await writeFile(path, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  return path;
}
export async function claudeFixtures(home: string): Promise<void> {
  await cp(join(repository, 'fixtures/claude-code/projects'), join(home, '.claude/projects'), {
    recursive: true,
  });
}
export async function codexFixtures(home: string): Promise<void> {
  await cp(join(repository, 'fixtures/codex/home'), join(home, '.codex'), { recursive: true });
}
export const testServer = (generation = 1): HighwaterServer => ({
  baseUrl: 'http://127.0.0.1:12345',
  generation,
  pid: 1,
  version: '0.5.1',
  signal: new AbortController().signal,
});
export function analysis(tokens: (number | string | null)[] = [10, 30, 15]) {
  return {
    schemaVersion: 1,
    modelCalls: tokens.map((reportedPromptTokens) => ({ reportedPromptTokens })),
    compactions: [],
  };
}
export function response(body: unknown, etag = '"v1"'): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', etag },
  });
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

/** Matches the innermost element whose whole text is `text`, even when split across spans. */
export function wholeText(text: string) {
  return (_: string, element: Element | null) =>
    element?.textContent === text &&
    [...element.children].every((child) => child.textContent !== text);
}
