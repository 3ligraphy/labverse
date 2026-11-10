/** C++ colours for static code (no DOM): predict cards, puzzles, and the server-rendered fallback. */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const KW = new Set(['if', 'else', 'while', 'for', 'do', 'return', 'break', 'continue', 'switch', 'case', 'default', 'using', 'namespace', 'const', 'and', 'or', 'not', 'true', 'false', 'static_cast', 'auto']);
export const TYPES = new Set(['int', 'float', 'double', 'char', 'bool', 'void', 'long', 'short', 'unsigned', 'signed', 'string', 'size_t', 'std']);
export const STREAMS = new Set(['cout', 'cin', 'endl', 'npos', 'getline']);

/** C++ source → HTML spans (classes cx-kw, cx-ty, cx-str, cx-num, cx-com, cx-pp, cx-fn, cx-io, cx-op) */
export function highlightCpp(code: string): string {
  let html = '';
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(^[ \t]*#[^\n]*)|("(?:[^"\\\n]|\\.)*"?)|('(?:[^'\\\n]|\\.)*'?)|(\b\d+(?:\.\d*)?(?:[eE][+-]?\d+)?[fFlLuU]*\b|\.\d+)|([A-Za-z_]\w*)|(<<|>>|\+\+|--|[+\-*/%=<>!&|]=?|::|[{}()[\];,.?:])|(\s+)|(.)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const [t, com, pp, str, chr, numb, id, op, ws] = m;
    if (com) html += `<span class="cx-com">${esc(com)}</span>`;
    else if (pp) html += `<span class="cx-pp">${esc(pp)}</span>`;
    else if (str) html += `<span class="cx-str">${esc(str)}</span>`;
    else if (chr) html += `<span class="cx-str">${esc(chr)}</span>`;
    else if (numb) html += `<span class="cx-num">${esc(numb)}</span>`;
    else if (id) {
      const after = code.slice(re.lastIndex).match(/^\s*\(/);
      const cls = KW.has(id) ? 'cx-kw' : TYPES.has(id) ? 'cx-ty' : STREAMS.has(id) ? 'cx-io' : after ? 'cx-fn' : 'cx-id';
      html += `<span class="${cls}">${esc(id)}</span>`;
    } else if (op) html += `<span class="cx-op">${esc(op)}</span>`;
    else if (ws) html += ws;
    else html += esc(t);
  }
  return html;
}

/** one <span class="cx-line"> per line, for line numbers and the "current line" highlight */
export function highlightLines(code: string): string[] {
  // highlight the whole text first (comments can span lines), then split on newlines outside tags
  const html = highlightCpp(code);
  const lines: string[] = [];
  let open: string[] = [];
  let cur = '';
  const tag = /<span class="([^"]+)">|<\/span>|\n|[^<\n]+/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html))) {
    if (m[0] === '\n') {
      cur += '</span>'.repeat(open.length);
      lines.push(cur);
      cur = open.map((c) => `<span class="${c}">`).join('');
    } else if (m[1]) { open.push(m[1]); cur += m[0]; }
    else if (m[0] === '</span>') { open.pop(); cur += m[0]; }
    else cur += m[0];
  }
  lines.push(cur + '</span>'.repeat(open.length));
  open = [];
  return lines;
}

