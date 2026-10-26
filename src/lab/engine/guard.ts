/** Runtime helpers for compiled student code (kept apart from compile.ts so the preview bundles stay small). */

/**
 * The guard every loop calls. A loop that keeps the page busy for more than 1.5 seconds without a break
 * is stopped with `fail(line)`; quick loops (even long ones) are never interrupted.
 */
export function createLoopGuard(fail: (line: number) => Error, limitMs = 1500) {
  let ticks = 0;
  let start = 0;
  let watching = false;
  return (line: number) => {
    if (++ticks % 512 !== 0) return;
    const now = Date.now();
    if (!watching) {
      watching = true;
      start = now;
      // reset once the page gets a breather; an endless loop never lets this run
      setTimeout(() => {
        watching = false;
        ticks = 0;
      }, 0);
      return;
    }
    if (now - start > limitMs) {
      watching = false;
      ticks = 0;
      throw fail(line);
    }
  };
}

/** Public build settings code can read through process.env, like Expo's EXPO_PUBLIC_ variables. */
export const PREVIEW_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  EXPO_PUBLIC_APP_ENV: 'development',
  EXPO_PUBLIC_API_URL: 'http://localhost:3000',
};
