/** C++ colours: the CodeMirror mode for the editor (static code: ../highlight.ts). */
import { StreamLanguage, type StringStream } from '@codemirror/language';
import { KW, STREAMS, TYPES } from '../highlight.ts';

export { highlightCpp, highlightLines } from '../highlight.ts';

type State = { comment: boolean };
const mode = {
  name: 'cpp',
  startState: (): State => ({ comment: false }),
  token(stream: StringStream, state: State): string | null {
    if (state.comment) {
      if (stream.skipTo('*/')) { stream.next(); stream.next(); state.comment = false; } else stream.skipToEnd();
      return 'comment';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match('/*')) { state.comment = true; return 'comment'; }
    if (stream.sol() && stream.match(/^\s*#.*/)) return 'meta';
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string';
    if (stream.match(/^'(?:[^'\\]|\\.)*'?/)) return 'string';
    if (stream.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFlLuU]*/)) return 'number';
    const word = stream.match(/^[A-Za-z_]\w*/) as RegExpMatchArray | null;
    if (word) {
      const w = word[0];
      if (w === 'true' || w === 'false') return 'bool';
      if (KW.has(w)) return 'keyword';
      if (TYPES.has(w)) return 'typeName';
      if (STREAMS.has(w)) return 'variableName.standard';
      if (stream.match(/^\s*\(/, false)) return 'variableName.function';
      return 'variableName';
    }
    if (stream.match(/^(<<|>>|\+\+|--|[+\-*/%=<>!&|]=?|::)/)) return 'operator';
    stream.next();
    return 'punctuation';
  },
};

export const cppLanguage = StreamLanguage.define(mode);
