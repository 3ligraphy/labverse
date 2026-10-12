/**
 * The web sandbox's code editor: CodeMirror 6 with a small HTML + CSS highlighter (a stream parser, since the
 * HTML/CSS language packages are not dependencies). Loaded on demand by src/scripts/web-lab.ts; until it arrives the
 * sandbox uses its plain <textarea>.
 */
import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, bracketMatching, indentUnit, syntaxHighlighting, type StringStream } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

type Mode = 'text' | 'tag' | 'css' | 'script' | 'comment' | 'cssComment' | 'jsComment';
type State = { mode: Mode; tag: string; closing: boolean; cssBlock: number; back: Mode };

/** Raw-text elements: <style> switches to CSS, <script> to (lightly highlighted) JavaScript. */
function afterTag(s: State): Mode {
  if (s.closing) return 'text';
  if (s.tag === 'style') return 'css';
  if (s.tag === 'script') return 'script';
  return 'text';
}

const JS_WORDS = /^(?:const|let|var|function|return|if|else|for|while|of|in|new|class|import|export|from|async|await|true|false|null|undefined|this|document|window)\b/;

function token(stream: StringStream, s: State): string | null {
  switch (s.mode) {
    case 'comment':
      if (stream.skipTo('-->')) { stream.match('-->'); s.mode = 'text'; } else stream.skipToEnd();
      return 'comment';
    case 'cssComment':
    case 'jsComment':
      if (stream.skipTo('*/')) { stream.match('*/'); s.mode = s.back; } else stream.skipToEnd();
      return 'comment';
    case 'tag': {
      if (stream.eatSpace()) return null;
      if (stream.match(/^\/?>/)) { s.mode = afterTag(s); return 'angleBracket'; }
      if (stream.match(/^"[^"]*"?/) || stream.match(/^'[^']*'?/)) return 'string';
      if (stream.eat('=')) return 'operator';
      if (stream.match(/^[^\s=>"'/]+/)) return 'attributeName';
      stream.next();
      return null;
    }
    case 'css': {
      if (stream.match(/^<\/style\s*>/i, false)) { s.mode = 'text'; return null; }
      if (stream.eatSpace()) return null;
      if (stream.match('/*')) { s.mode = 'cssComment'; s.back = 'css'; return 'comment'; }
      if (stream.match(/^"[^"]*"?/) || stream.match(/^'[^']*'?/)) return 'string';
      if (stream.eat('{')) { s.cssBlock++; return 'brace'; }
      if (stream.eat('}')) { s.cssBlock = Math.max(0, s.cssBlock - 1); return 'brace'; }
      if (stream.match(/^@[\w-]+/)) return 'keyword';
      if (stream.match(/^#[0-9a-fA-F]{3,8}\b/) && s.cssBlock) return 'color';
      if (stream.match(/^-?\d*\.?\d+(?:[a-z%]+)?/)) return 'number';
      if (s.cssBlock) {
        if (stream.match(/^--?[\w-]+(?=\s*:)/) || stream.match(/^[\w-]+(?=\s*:)/)) return 'propertyName';
        if (stream.match(/^!important/)) return 'keyword';
        if (stream.match(/^[\w-]+(?=\()/)) return 'function';
        if (stream.match(/^[\w-]+/)) return 'atom';
      } else {
        if (stream.match(/^\.[\w-]+/)) return 'className';
        if (stream.match(/^#[\w-]+/)) return 'labelName';
        if (stream.match(/^::?[\w-]+/)) return 'keyword';
        if (stream.match(/^[\w-]+/)) return 'tagName';
      }
      stream.next();
      return null;
    }
    case 'script': {
      if (stream.match(/^<\/script\s*>/i, false)) { s.mode = 'text'; return null; }
      if (stream.eatSpace()) return null;
      if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
      if (stream.match('/*')) { s.mode = 'jsComment'; s.back = 'script'; return 'comment'; }
      if (stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^'(?:[^'\\]|\\.)*'?/) || stream.match(/^`[^`]*`?/)) return 'string';
      if (stream.match(/^\d+(?:\.\d+)?/)) return 'number';
      if (stream.match(JS_WORDS)) return 'keyword';
      if (stream.match(/^[A-Za-z_$][\w$]*(?=\()/)) return 'function';
      if (stream.match(/^[A-Za-z_$][\w$]*/)) return null;
      stream.next();
      return null;
    }
    default: {
      if (stream.match('<!--')) { s.mode = 'comment'; return 'comment'; }
      if (stream.match(/^<!doctype[^>]*>/i)) return 'meta';
      const open = stream.match(/^<(\/?)([A-Za-z][\w-]*)/) as RegExpMatchArray | null;
      if (open) {
        s.closing = open[1] === '/';
        s.tag = open[2].toLowerCase();
        s.mode = 'tag';
        return 'tagName';
      }
      if (stream.match(/^&[#\w]+;/)) return 'atom';
      stream.next();
      while (!stream.eol() && stream.peek() !== '<' && stream.peek() !== '&') stream.next();
      return null;
    }
  }
}

export const htmlCss = StreamLanguage.define<State>({
  name: 'html-css',
  startState: () => ({ mode: 'text', tag: '', closing: false, cssBlock: 0, back: 'css' }),
  copyState: (s) => ({ ...s }),
  token,
  tokenTable: { brace: t.brace, color: t.color, function: t.function(t.variableName) },
  languageData: { commentTokens: { block: { open: '<!--', close: '-->' } } },
});

const highlight = HighlightStyle.define([
  { tag: t.tagName, color: 'var(--ws-tag)' },
  { tag: t.angleBracket, color: 'var(--ws-punc)' },
  { tag: t.attributeName, color: 'var(--ws-attr)' },
  { tag: t.string, color: 'var(--ws-str)' },
  { tag: t.comment, color: 'var(--ws-com)', fontStyle: 'italic' },
  { tag: [t.propertyName], color: 'var(--ws-prop)' },
  { tag: [t.number, t.color], color: 'var(--ws-num)' },
  { tag: [t.keyword, t.meta], color: 'var(--ws-kw)' },
  { tag: [t.className, t.labelName], color: 'var(--ws-sel)' },
  { tag: [t.atom], color: 'var(--ws-val)' },
  { tag: [t.function(t.variableName)], color: 'var(--ws-fn)' },
  { tag: [t.brace, t.operator], color: 'var(--ws-punc)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13.5px', backgroundColor: 'var(--code-bg)', color: 'var(--text)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65', overflow: 'auto' },
  '.cm-content': { padding: '12px 0', caretColor: 'var(--accent-text)' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--text-3)', border: 'none', paddingLeft: '4px' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-2)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--text) 4%, transparent)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent-text)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in oklab, var(--info) 28%, transparent) !important' },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in oklab, var(--accent) 22%, transparent)', outline: 'none' },
});

export function createWebEditor(opts: { parent: HTMLElement; doc: string; label: string; onChange: () => void; onRun: () => void }) {
  let silent = false; // set() from code (Reset, fence removal) is not a student edit
  const view = new EditorView({
    parent: opts.parent,
    state: EditorState.create({
      doc: opts.doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        closeBrackets(),
        indentUnit.of('  '),
        EditorState.tabSize.of(2),
        EditorView.lineWrapping,
        htmlCss,
        syntaxHighlighting(highlight),
        // Ctrl/Cmd+Enter runs; Tab indents (Esc, then Tab, moves focus out: CodeMirror's escape hatch)
        keymap.of([{ key: 'Mod-Enter', run: () => { opts.onRun(); return true; } }, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        theme,
        EditorView.contentAttributes.of({ 'aria-label': opts.label, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
        EditorView.updateListener.of((u) => { if (u.docChanged && !silent) opts.onChange(); }),
      ],
    }),
  });
  return {
    get: () => view.state.doc.toString(),
    set: (v: string) => {
      silent = true;
      try { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } }); } finally { silent = false; }
    },
    focus: () => view.focus(),
  };
}
