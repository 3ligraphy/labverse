/**
 * Reads a lab's outline straight from its MDX source:
 *   <Part n="1" title="Meet the course" time="10 min" />
 *   <Task n="1.1" title="Your teaching team" time="2 min">
 * Used for the lab tracker, the header part strip and search.
 */
export type LabTask = { n: string; title: string; time?: string; id: string };
export type LabPart = { n: string; title: string; time?: string; id: string; tasks: LabTask[] };

const attr = (src: string, name: string) => src.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

export function parseLabOutline(body = ''): LabPart[] {
  const parts: LabPart[] = [];
  const re = /<(Part|Task)\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const [, kind, attrs] = m;
    const n = attr(attrs, 'n') ?? '';
    const title = attr(attrs, 'title') ?? '';
    const time = attr(attrs, 'time');
    if (kind === 'Part') parts.push({ n, title, time, id: `part-${n}`, tasks: [] });
    else {
      if (!parts.length) parts.push({ n: '0', title: 'Tasks', id: 'part-0', tasks: [] });
      parts[parts.length - 1].tasks.push({ n, title, time, id: `task-${n.replace(/\./g, '-')}` });
    }
  }
  return parts;
}

/** "45 min", "1 h 40 min", "1 hour 15 min", "2 hours", "1.5 h" → minutes (a bare number is minutes; nothing → 0) */
export const minutes = (t?: string): number => {
  if (!t) return 0;
  const h = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  const m = t.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);
  if (h || m) return Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
  return Number(t.match(/\d+/)?.[0] ?? 0);
};

/** 375 → "6 h 15 min", 60 → "1 h", 45 → "45 min", 0 → "" (the way the parts write their own times) */
export const formatMinutes = (total: number): string => {
  if (!total) return '';
  const h = Math.floor(total / 60), m = total % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ');
};
