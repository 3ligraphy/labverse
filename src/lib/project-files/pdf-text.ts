/** Reconstruct visual rows: PDF content streams need not store table cells in reading order. */
export type PdfTextItem = { str: string; transform: number[]; width: number; hasEOL?: boolean };

export function pdfTextRows(items: readonly PdfTextItem[]): string[] {
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of [...items].filter((i) => i.str.trim()).sort((a, b) => b.transform[5] - a.transform[5])) {
    const y = item.transform[5];
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - y) <= 2) row.items.push(item);
    else rows.push({ y, items: [item] });
  }
  return rows.map((row) => {
    let line = '';
    let end = 0;
    for (const item of row.items.sort((a, b) => a.transform[4] - b.transform[4])) {
      const gap = item.transform[4] - end;
      const size = Math.hypot(item.transform[0], item.transform[1]);
      if (line && gap > Math.max(5, size * 0.6)) line += ' | ';
      else if (line && gap > 0.5 && !line.endsWith(' ') && !item.str.startsWith(' ')) line += ' ';
      line += item.str;
      end = item.transform[4] + item.width;
    }
    return line;
  });
}
