/**
 * A small, dependency-light Excel (.xlsx) writer: several sheets of text/number cells with a few fixed styles,
 * column widths and frozen header rows.
 *
 * The package is zipped here, not with a streaming zipper: Excel refuses ("cannot be repaired") entries that
 * are stored with their sizes in trailing data descriptors. Every entry is deflated, with CRC and sizes in
 * its local header, and the central directory follows: the classic layout every Office version reads.
 */
import { crc32, deflateRawSync } from 'node:zlib';

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
  return zip(files.map((f) => ({ name: f.name, data: new TextEncoder().encode(f.input) })));
}

/** A plain zip archive (deflate, no data descriptors, no Zip64): what Excel expects inside an .xlsx. */
export function zip(entries: { name: string; data: Uint8Array }[], when = new Date()): Uint8Array {
  // MS-DOS date and time, as zip headers store them
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const dosDate = ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = new TextEncoder().encode(e.name);
    const packed = deflateRawSync(e.data, { level: 6 });
    const crc = crc32(e.data) >>> 0;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header
    local.setUint16(4, 20, true); // version needed: 2.0 (deflate)
    local.setUint16(6, 0x0800, true); // flags: UTF-8 names
    local.setUint16(8, 8, true); // method: deflate
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, packed.length, true);
    local.setUint32(22, e.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true); // central directory header
    dir.setUint16(4, 20, true); // made by
    dir.setUint16(6, 20, true); // version needed
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 8, true);
    dir.setUint16(12, dosTime, true);
    dir.setUint16(14, dosDate, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, packed.length, true);
    dir.setUint32(24, e.data.length, true);
    dir.setUint16(28, name.length, true);
    // extra length, comment length, disk number, internal attrs, external attrs: all 0
    dir.setUint32(42, offset, true); // where the local header starts
    parts.push(new Uint8Array(local.buffer), name, packed);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + packed.length;
  }
  const dirSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}
