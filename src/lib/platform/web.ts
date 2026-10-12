/**
 * Helpers for the no-code web lab blocks (AI prompt cards, website previews, the HTML/CSS sandbox).
 * Pure functions: used on the server (Astro components), in the browser (src/scripts/web-lab.ts) and in tests.
 */

/**
 * Staff- or student-written HTML as a full page for an <iframe srcdoc>. A snippet like `<style>…</style><h1>Hi</h1>`
 * gets a doctype (no quirks mode, so CSS behaves like on a real site) and a UTF-8 charset.
 */
export function pageDoc(html: string): string {
  const src = html.trim();
  if (/^<!doctype\s/i.test(src)) return src;
  return `<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${src}`;
}

/**
 * Code pasted from ChatGPT often keeps its Markdown fence (```html … ```). Returns the code inside the first fenced
 * block when there is one, else the text unchanged; `stripped` says whether anything was removed.
 */
export function stripFences(code: string): { code: string; stripped: boolean } {
  const m = code.match(/^\s*(`{3,}|~{3,})[\w-]*[^\n]*\n([\s\S]*?)\n?\s*\1\s*$/);
  if (m) return { code: m[2], stripped: true };
  const inner = code.match(/(`{3,})(?:html|htm|xml|css)?[^\n]*\n([\s\S]*?)\n\s*\1/i);
  if (inner && /<[a-z!]/i.test(inner[2])) return { code: inner[2], stripped: true };
  return { code, stripped: false };
}

/** A prompt split into plain text and [placeholder] parts (students replace the bracketed ones). */
export function promptParts(prompt: string): { text: string; slot: boolean }[] {
  const out: { text: string; slot: boolean }[] = [];
  const re = /\[[^\[\]\n]{1,80}\]/g;
  let last = 0;
  for (const m of prompt.matchAll(re)) {
    // a Markdown link "[text](url)" is not a placeholder
    if (prompt[m.index + m[0].length] === '(') continue;
    if (m.index > last) out.push({ text: prompt.slice(last, m.index), slot: false });
    out.push({ text: m[0], slot: true });
    last = m.index + m[0].length;
  }
  if (last < prompt.length) out.push({ text: prompt.slice(last), slot: false });
  return out;
}

/** "Open in …" link that starts a chat with the prompt filled in, for assistants that support it; else null. */
export function assistantLink(tool: string, prompt: string): { href: string; label: string } | null {
  const q = encodeURIComponent(prompt.trim());
  switch (tool.trim().toLowerCase()) {
    case 'chatgpt': return { href: `https://chatgpt.com/?q=${q}`, label: 'Open in ChatGPT' };
    case 'claude': return { href: `https://claude.ai/new?q=${q}`, label: 'Open in Claude' };
    default: return null;
  }
}

/** youtube-nocookie / player.vimeo embed URL → the normal watch page (for networks that block embeds). */
export function watchUrl(embed: string): string | null {
  const yt = embed.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]+)/);
  if (yt) return `https://www.youtube.com/watch?v=${yt[1]}`;
  const vm = embed.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (vm) return `https://vimeo.com/${vm[1]}`;
  return null;
}

/** Host name for display ("www.wordpress.com" → "wordpress.com"). */
export const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};
