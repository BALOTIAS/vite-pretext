import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface Fixture {
  dir: string;
  cleanup: () => Promise<void>;
}

// Write a tmp dir of files keyed by relative path. Returns the (canonical)
// absolute dir and a cleanup function.
//
// The realpath is important on macOS: tmpdir() returns /var/folders/..., but
// Vite/Rolldown internally resolves to /private/var/folders/..., which then
// breaks the relative-path math when emitting the index.html asset.
export async function setupFixture(files: Record<string, string>): Promise<Fixture> {
  const raw = await mkdtemp(path.join(tmpdir(), 'vite-pretext-test-'));
  const dir = await realpath(raw);
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }
  return {
    dir,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
