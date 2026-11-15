/**
 * The attendance workbook: Summary (every student × every week, with warnings), Warnings, one sheet per
 * week (who came to which session) and Sessions. Pure apart from the zip; tested in tests/attendance-weekly.test.ts.
 */
import { buildXlsx, type StyleName, type XCell, type XSheet } from '../xlsx.ts';
import { TIME_ZONE, WARNING_AT, labBadge, type CellStatus, type Register, type WeekInfo } from './weekly.ts';

/** "Lab 02 · Part 1/2" for the week's main lab, or '' */
const weekLab = (w: WeekInfo) => { const m = w.labs?.find((l) => l.main); return m ? labBadge(m) : ''; };

const LETTER: Record<CellStatus, string> = { present: 'P', absent: 'A', excused: 'E', pending: '–' };
const levelStyle: StyleName[] = ['ok', 'warning1', 'warning2', 'barred'];
const time = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';

export function registerSheets(reg: Register, meta: { module: string; generatedAt?: Date }): XSheet[] {
  const generated = time((meta.generatedAt ?? new Date()).toISOString());
  const rules = `Rules: ${WARNING_AT[0]} absences = Warning 1 · ${WARNING_AT[1]} = Warning 2 · ${WARNING_AT[2]}+ = Barred. P present · A absent · E excused · – week not over yet.`;
  const sessionById = new Map(reg.weeks.flatMap((w) => w.sessions.map((s) => [s.id, s] as const)));

  const summaryHead = ['#', 'Name', 'Student ID', 'Group', ...reg.weeks.map((w) => `${w.label}${weekLab(w) ? ` · ${weekLab(w)}` : ''} (${w.range})`), 'Attended', 'Absences', 'Excused', 'Status'];
  const summary: XSheet = {
    name: 'Summary',
    freezeRows: 4,
    freezeCols: 3,
    widths: [5, 30, 14, 14, ...reg.weeks.map(() => 18), 10, 10, 10, 16],
    rows: [
      [{ v: `${meta.module} — attendance register`, s: 'title' }],
      [{ v: `Generated ${generated} (Cairo time)`, s: 'muted' }],
      [{ v: rules, s: 'muted' }],
      summaryHead.map((h) => ({ v: h, s: 'header' as StyleName })),
      ...reg.students.map((st, i): XCell[] => [
        i + 1, st.name, st.id, st.group,
        ...reg.weeks.map((w) => ({ v: LETTER[st.cells[w.key].status], s: st.cells[w.key].status as StyleName })),
        st.attended, st.absences, st.excused,
        { v: st.status, s: levelStyle[st.level] },
      ]),
    ],
  };

  const flagged = reg.students.filter((s) => s.level > 0);
  const warnings: XSheet = {
    name: 'Warnings',
    freezeRows: 1,
    widths: [30, 14, 14, 10, 16, 60],
    rows: [
      ['Name', 'Student ID', 'Group', 'Absences', 'Status', 'Weeks absent'].map((h) => ({ v: h, s: 'header' as StyleName })),
      ...flagged.map((st): XCell[] => [
        st.name, st.id, st.group, st.absences, { v: st.status, s: levelStyle[st.level] },
        reg.weeks.filter((w) => st.cells[w.key].status === 'absent').map((w) => `${w.label} (${w.range})`).join(', '),
      ]),
      ...(flagged.length ? [] : [[{ v: 'No student has a warning.', s: 'muted' as StyleName }]]),
    ],
  };

  const weekSheets: XSheet[] = reg.weeks.map((w) => ({
    name: `${w.label}${weekLab(w) ? ` ${weekLab(w).replace('Lab ', 'L').replace(' · Part ', ' p').replace('/', 'of')}` : ''} ${w.range.split(' – ')[0]}`,
    freezeRows: 3,
    widths: [30, 14, 14, 12, 34, 18, 22, 20, 30],
    rows: [
      [{ v: `${w.label}${weekLab(w) ? ` · ${weekLab(w)}` : ''} · ${w.range}${w.over ? '' : ' (in progress)'}`, s: 'title' }],
      [{ v: `${w.present} of ${reg.students.length} present · ${w.sessions.length} session${w.sessions.length === 1 ? '' : 's'}`, s: 'muted' }],
      ['Name', 'Student ID', 'Group', 'Status', 'Lab', 'TA', 'Time slot', 'Checked in', 'Note'].map((h) => ({ v: h, s: 'header' as StyleName })),
      ...[...reg.students].sort((a, b) => a.name.localeCompare(b.name)).map((st): XCell[] => {
        const c = st.cells[w.key];
        const s = c.sessionId ? sessionById.get(c.sessionId) : undefined;
        const label = { present: 'Present', absent: 'Absent', excused: 'Excused', pending: 'Not yet' }[c.status];
        return [st.name, st.id, st.group, { v: label, s: c.status as StyleName }, s?.labTitle ?? '', s?.ta ?? '', s?.slot ?? '', time(c.at), c.status === 'excused' ? [c.note, c.by && `by ${c.by}`].filter(Boolean).join(' — ') : ''];
      }),
    ],
  }));

  const sessions: XSheet = {
    name: 'Sessions',
    freezeRows: 1,
    widths: [10, 16, 34, 18, 22, 20, 20, 12],
    rows: [
      ['Week', 'Week dates', 'Lab', 'TA', 'Time slot', 'Opened', 'Closed', 'Checked in'].map((h) => ({ v: h, s: 'header' as StyleName })),
      ...reg.weeks.flatMap((w) => w.sessions.map((s): XCell[] => [w.label, w.range, s.labTitle, s.ta, s.slot, time(s.opensAt), time(s.closesAt) || 'open', s.checkedIn])),
    ],
  };

  return [summary, warnings, ...weekSheets, sessions];
}

export const registerWorkbook = (reg: Register, meta: { module: string; generatedAt?: Date }) => buildXlsx(registerSheets(reg, meta));
