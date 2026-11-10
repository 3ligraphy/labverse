const HEAD = '#include <iostream>\n#include <string>\n#include <cmath>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n';

/** a snippet of statements → a whole program (and how many lines were added on top) */
export function wrapProgram(code: string): { src: string; offset: number } {
  if (/\b(int|void)\s+main\s*\(/.test(code)) return { src: code, offset: 0 };
  const body = code.replace(/\s+$/, '').split('\n').map((l) => (l ? `    ${l}` : l)).join('\n');
  return { src: `${HEAD}${body}\n    return 0;\n}\n`, offset: HEAD.split('\n').length - 1 };
}
