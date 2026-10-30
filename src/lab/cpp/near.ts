/**
 * "Near enough" output: the same text when only the spacing differs. Such output passes, with a warning that says
 * what to fix. Runs of spaces count as one, and spaces at the ends of a line or next to punctuation do not count.
 * Letters, digits, tabs and line breaks must all match, so a wrong value, a missing word, a missing line, or a space
 * where a tab (\t) belongs still fails.
 */
export const nearLine = (line: string) => line.replace(/ +/g, ' ').replace(/ ?([^\p{L}\p{N}_ ]) ?/gu, '$1').trim();

/** every line near-normalised; empty lines at the end (an endl too many or too few) do not count */
export const nearText = (s: string) => s.replace(/\r\n?/g, '\n').split('\n').map(nearLine).join('\n').replace(/\n+$/, '');

/** the output without spaces at the ends of lines and without empty lines at the end */
export const tidyOutput = (s: string) => s.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/ +$/, '')).join('\n').replace(/\n+$/, '');

const trailingBreaks = (s: string) => s.replace(/\r\n?/g, '\n').match(/\n*$/)![0].length;

/** what differs when only the ends differ: spaces at line ends, or an endl too many or too few at the end */
export function endsWarning(want: string, got: string): string {
  const extra = trailingBreaks(got) - trailingBreaks(want);
  if (extra > 0) return 'Accepted, but your output ends with an extra empty line (an `endl` or `\\n` too many at the end).';
  if (extra < 0) return 'Accepted, but the output should end with a new line (`endl` or `\\n` at the end).';
  return 'Accepted, but there are extra spaces at the end of a line.';
}

/**
 * `text` appears in `output`, and a number at either end of `text` is the whole number there: 8 is not found in
 * 88, 18, 8.5, 2.8 or -8 (a wrong value never passes because it starts or ends with the right digits).
 */
export function containsOutput(output: string, text: string): boolean {
  if (!text) return true;
  const startsNum = /^\d/.test(text);
  const endsNum = /\d$/.test(text);
  for (let i = output.indexOf(text); i !== -1; i = output.indexOf(text, i + 1)) {
    const before = output.slice(Math.max(0, i - 2), i);
    const after = output.slice(i + text.length, i + text.length + 2);
    if (startsNum && (/\d$/.test(before) || /\d\.$/.test(before) || /(^|[^\p{L}\p{N}])-$/u.test(before))) continue;
    if (endsNum && (/^\d/.test(after) || /^\.\d/.test(after))) continue;
    return true;
  }
  return false;
}
