/**
 * A GROUP'S APP SOURCE — which files of a hand-in ZIP or a GitHub repo ZIP are the student's Expo app, for
 * "Open in BUENOVA Code" (the app's code in the browser IDE with its phone emulator) and for the evidence the
 * auto-marker reads (screens, folders). Only the app folder is kept, without node_modules, native folders, build
 * output or very large files, so it opens fast. Pure functions (tests/automark.test.ts).
 */

/** Folders that are never part of the app's code (installed packages, native projects, build output, git). */
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.expo|\.idea|\.gradle|__MACOSX|android|ios|dist|web-build|build|\.next|coverage|\.turbo|\.cache)\//;
const SKIP_FILE = /(^|\/)(\._[^/]*|\.DS_Store|Thumbs\.db|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$/i;
/** Bigger files (videos, huge images) are left out: the code and its normal assets are what matter. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_FILES = 3000;

/** Whether a file of the archive is worth copying (not a folder, not skipped, not too big). */
export function keepFile(name: string, size: number): boolean {
  // '' is the app folder's own entry (repo-main/ when the app is the whole repo): a folder, not a file
  return name !== '' && !name.endsWith('/') && !name.includes('..') && !SKIP_DIR.test(name) && !SKIP_FILE.test(name) && size <= MAX_FILE_BYTES;
}

/**
 * The folder of the Expo app among the package.json files of an archive: the shallowest one that depends on expo,
 * else on react-native. '' is the archive's top, 'repo-main/app/' a folder (with its slash). Null: no app.
 */
export function appRoot(pkgs: readonly { path: string; text: string }[]): string | null {
  const scored = pkgs
    .filter((p) => /(^|\/)package\.json$/.test(p.path) && !SKIP_DIR.test(p.path))
    .map((p) => {
      let deps: Record<string, unknown> = {};
      try {
        const j = JSON.parse(p.text);
        deps = { ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) };
      } catch {
        /* a broken package.json is not the app */
      }
      return { dir: p.path.slice(0, -'package.json'.length), depth: p.path.split('/').length, rank: deps.expo ? 0 : deps['react-native'] ? 1 : 9 };
    })
    .filter((p) => p.rank < 9)
    .sort((a, b) => a.rank - b.rank || a.depth - b.depth || a.dir.localeCompare(b.dir));
  return scored[0]?.dir ?? null;
}

/** The files under `root`, relative to it, that keepFile accepts (at most MAX_FILES, code before assets). */
export function appFiles(names: readonly { name: string; size: number }[], root: string): string[] {
  const code = /\.(tsx?|jsx?|mjs|cjs|json|css|md)$/i;
  return names
    .filter((n) => n.name.startsWith(root) && keepFile(n.name.slice(root.length), n.size))
    .map((n) => n.name)
    .sort((a, b) => Number(!code.test(a)) - Number(!code.test(b)) || a.localeCompare(b))
    .slice(0, MAX_FILES);
}
