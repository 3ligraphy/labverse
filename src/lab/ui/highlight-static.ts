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

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** TypeScript / TSX → one HTML string per line (blank lines are '') */
export function highlightLines(code: string): string[] {
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
