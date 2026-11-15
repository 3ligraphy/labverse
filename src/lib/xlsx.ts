/**
 * A small, dependency-light Excel (.xlsx) writer: several sheets of text/number cells with a few fixed styles,
 * column widths and frozen header rows. The package is zipped with client-zip (already used for downloads).
 */
import { downloadZip } from 'client-zip';

export const STYLES = ['default', 'header', 'title', 'muted', 'present', 'absent', 'excused', 'pending', 'warning1', 'warning2', 'barred', 'ok'] as const;
export type StyleName = (typeof STYLES)[number];
export type XCell = string | number | null | undefined | { v: string | number | null; s?: StyleName };
export type XSheet = { name: string; rows: XCell[][]; widths?: number[]; freezeRows?: number; freezeCols?: number };

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    // characters XML 1.0 does not allow
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** A1-style column letters: 0 → A, 26 → AA. */
export function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Excel sheet names: ≤31 characters, none of []:*?/\ and unique in the workbook. */
export function sheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    const base = (raw.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Sheet').slice(0, 31);
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
    used.add(name.toLowerCase());
    return name;
  });
}

// fills: 0 none, 1 gray125 (both required), then our colours
const FILLS = ['D9E7FB', 'DCF5E3', 'FBDADA', 'E8E8E8', 'FFF4D6', 'FFE2C7', 'F9C9C9'];
const fill = (rgb: string) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
// fonts: 0 normal, 1 bold, 2 bold large, 3 gray, 4 bold dark red
const FONTS = [
  '<font><sz val="11"/><name val="Calibri"/></font>',
  '<font><b/><sz val="11"/><name val="Calibri"/></font>',
  '<font><b/><sz val="14"/><name val="Calibri"/></font>',
  '<font><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font>',
  '<font><b/><sz val="11"/><color rgb="FF9B1C1C"/><name val="Calibri"/></font>',
];
/** style → [font, fill (index into the fills list incl. the two built-ins), border?, centred?] */
const XF: Record<StyleName, [number, number, boolean, boolean]> = {
  default: [0, 0, true, false],
  header: [1, 2, true, true],
  title: [2, 0, false, false],
  muted: [3, 0, false, false],
  present: [0, 3, true, true],
  absent: [1, 4, true, true],
  excused: [0, 5, true, true],
  pending: [3, 0, true, true],
  warning1: [1, 6, true, false],
  warning2: [1, 7, true, false],
  barred: [4, 8, true, false],
  ok: [0, 3, true, false],
};

function stylesXml() {
  const xfs = STYLES.map((s) => {
    const [font, fillId, border, centre] = XF[s];
    return `<xf numFmtId="0" fontId="${font}" fillId="${fillId}" borderId="${border ? 1 : 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"${centre ? ' horizontal="center"' : ''} wrapText="0"/></xf>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${FONTS.length}">${FONTS.join('')}</fonts>
<fills count="${FILLS.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${FILLS.map(fill).join('')}</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD0D0D0"/></left><right style="thin"><color rgb="FFD0D0D0"/></right><top style="thin"><color rgb="FFD0D0D0"/></top><bottom style="thin"><color rgb="FFD0D0D0"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function cellXml(cell: XCell, ref: string): string {
  const { v, s } = cell !== null && typeof cell === 'object' ? cell : { v: cell ?? null, s: undefined };
  const style = STYLES.indexOf(s ?? 'default');
  if (v === null || v === undefined || v === '') return style ? `<c r="${ref}" s="${style}"/>` : '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

function sheetXml(sheet: XSheet): string {
  const rows = sheet.rows.map((row, r) => `<row r="${r + 1}">${row.map((c, i) => cellXml(c, `${colName(i)}${r + 1}`)).join('')}</row>`).join('');
  const fr = sheet.freezeRows ?? 0, fc = sheet.freezeCols ?? 0;
  const pane = fr || fc
    ? `<pane${fc ? ` xSplit="${fc}"` : ''}${fr ? ` ySplit="${fr}"` : ''} topLeftCell="${colName(fc)}${fr + 1}" activePane="${fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight'}" state="frozen"/>`
    : '';
  const cols = sheet.widths?.length ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData>
</worksheet>`;
}

/** Builds the .xlsx file. */
export async function buildXlsx(sheets: XSheet[]): Promise<Uint8Array> {
  const names = sheetNames(sheets.map((s) => s.name));
  const files: { name: string; input: string }[] = [
    { name: '[Content_Types].xml', input: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>` },
    { name: '_rels/.rels', input: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', input: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', input: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
    { name: 'xl/styles.xml', input: stylesXml() },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, input: sheetXml(s) })),
  ];
  const lastModified = new Date();
  return new Uint8Array(await downloadZip(files.map((f) => ({ ...f, lastModified }))).arrayBuffer());
}
