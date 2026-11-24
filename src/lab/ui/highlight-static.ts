/**
 * Coloured code built on the server (Astro) — the same colours as the lab editor, as fixed class names
 * (tk-kw, tk-str, …) that read the theme's --cm-* colours (src/styles/lab-interactive.css). One HTML string per
 * line, so a walk-through can light, dim and number each line. Works in Node: no DOM, no style mounting.
 */
import { highlightCode, tagHighlighter, tags as t } from '@lezer/highlight';
import { tsxLanguage } from '@codemirror/lang-javascript';

const classes = tagHighlighter([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword], class: 'tk-kw' },
  { tag: [t.string, t.special(t.string), t.regexp], class: 'tk-str' },
  { tag: [t.comment, t.lineComment, t.blockComment], class: 'tk-com' },
  { tag: [t.number, t.bool, t.null, t.atom], class: 'tk-num' },
  { tag: [t.tagName, t.standard(t.tagName)], class: 'tk-tag' },
  { tag: t.attributeName, class: 'tk-attr' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: 'tk-fn' },
  { tag: [t.typeName, t.className], class: 'tk-type' },
  { tag: [t.propertyName, t.definition(t.propertyName)], class: 'tk-prop' },
  { tag: [t.operator, t.punctuation, t.bracket, t.angleBracket, t.separator], class: 'tk-punc' },
  { tag: [t.variableName, t.definition(t.variableName)], class: 'tk-var' },
]);

/** text between tags: only & < > need escaping (class names are fixed, never from the code) */
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

const span = (cls: string, text: string) => (text ? `<span class="${cls}">${esc(text)}</span>` : '');

/** one line of JSON: keys, text, numbers, true / false / null, punctuation */
function jsonLine(line: string): string {
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g;
  let out = '';
  let last = 0;
  for (const m of line.matchAll(re)) {
    out += esc(line.slice(last, m.index));
    if (m[1]) out += m[2] ? span('tk-prop', m[1]) + span('tk-punc', m[2]) : span('tk-str', m[1]);
    else if (m[3]) out += span('tk-num', m[3]);
    else if (m[4]) out += span('tk-num', m[4]);
    else out += span('tk-punc', m[5]);
    last = m.index! + m[0].length;
  }
  return out + esc(line.slice(last));
}

/** a YAML value: text in quotes, numbers, true / false, ${VARIABLES}, inline { key: value } maps */
function yamlValue(v: string): string {
  const re = /("(?:[^"\\]|\\.)*"|'[^']*')|(\$\{\w+\})|\b(-?\d+(?:\.\d+)?|true|false|null)\b|([\w-]+)(\s*:)(?=\s)|([{}[\],])/g;
  let out = '';
  let last = 0;
  for (const m of v.matchAll(re)) {
    out += esc(v.slice(last, m.index));
    if (m[1]) out += span('tk-str', m[1]);
    else if (m[2]) out += span('tk-var', m[2]);
    else if (m[3]) out += span('tk-num', m[3]);
    else if (m[4]) out += span('tk-prop', m[4]) + span('tk-punc', m[5]);
    else out += span('tk-punc', m[6]);
    last = m.index! + m[0].length;
  }
  return out + esc(v.slice(last));
}

/** one line of YAML (Maestro flows): `- command:` steps, `key: value` pairs, `---`, `# comments` */
function yamlLine(line: string): string {
  if (/^\s*---\s*$/.test(line)) return span('tk-punc', line);
  // a # starts a comment when it is not inside quotes
  let body = line;
  let comment = '';
  let quote = '';
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) { body = line.slice(0, i); comment = line.slice(i); break; }
  }
  const m = /^(\s*)(-\s+)?(?:([\w.$/-]+)(\s*:)(?=\s|$))?([\s\S]*)$/.exec(body)!;
  const [, indent, dash = '', key, colon = '', rest] = m;
  // a key right after "- " is the step's command (tapOn, assertVisible …): coloured like a function
  const keyHtml = key ? span(dash ? 'tk-fn' : 'tk-prop', key) + span('tk-punc', colon) : '';
  // a bare command after the dash (`- stopApp`) is a command too
  const restHtml = dash && !key && /^[\w-]+\s*$/.test(rest) ? span('tk-fn', rest) : yamlValue(rest);
  return esc(indent) + span('tk-punc', dash) + keyHtml + restHtml + span('tk-com', comment);
}

export type CodeLang = 'tsx' | 'json' | 'yaml';

/** TypeScript / TSX (default), JSON or YAML → one HTML string per line (blank lines are '') */
export function highlightLines(code: string, lang: CodeLang = 'tsx'): string[] {
  if (lang === 'json') return code.split('\n').map(jsonLine);
  if (lang === 'yaml') return code.split('\n').map(yamlLine);
  const tree = tsxLanguage.parser.parse(code);
  const lines: string[] = [''];
  highlightCode(
    code,
    tree,
    classes,
    (text, cls) => {
      lines[lines.length - 1] += cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text);
    },
    () => lines.push(''),
  );
  return lines;
}
