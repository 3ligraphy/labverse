/** Lab 05 helpers: the course server's address, waiting for network answers, and reading colours. */
import type { PreviewDriver } from '../../runtime/protocol.ts';

/** The course server the exercises call (the same address works from a phone). */
export const SITE = 'https://labverse-indol.vercel.app';

/** Reads the screen until `test` passes (network answers take a moment) or the time is up. */
export async function waitForText(app: PreviewDriver, test: (text: string) => boolean, ms = 7000): Promise<string | null> {
  const end = Date.now() + ms;
  for (;;) {
    const text = await app.text();
    if (test(text)) return text;
    if (Date.now() > end) return null;
    await app.wait(200);
  }
}

/** 'green' / 'red' / null for a CSS colour like '#16a34a' or 'rgb(220, 38, 38)'. */
export function tone(color: unknown): 'green' | 'red' | null {
  if (typeof color !== 'string') return null;
  let r = 0, g = 0, b = 0;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(color.trim());
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else if (rgb) [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  else if (/^(green|lime|seagreen|forestgreen)$/i.test(color)) return 'green';
  else if (/^(red|crimson|firebrick|tomato)$/i.test(color)) return 'red';
  else return null;
  if (g > r + 30 && g > b) return 'green';
  if (r > g + 60 && r > b + 30) return 'red';
  return null;
}

/** Does any element showing this text have this colour (as its text colour or background)? */
export async function shownIn(app: PreviewDriver, text: RegExp, want: 'green' | 'red'): Promise<boolean> {
  const found = await app.find({ text });
  return found.some((f) => tone(f.style.color) === want || tone(f.style.backgroundColor) === want);
}

/** The JavaScript of one file without comments, so a TODO comment never counts as code. */
export const code = (files: Record<string, string>, file = 'App.tsx') => (files[file] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
