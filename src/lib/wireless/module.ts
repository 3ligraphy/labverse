/**
 * WIRELESS NETWORKS — the open module's contents. The module page (/wireless) lists these in two tracks,
 * Lectures and Labs, grouped by teaching week. Add a lecture or lab here and it appears on the module page.
 */
export type ModuleItem = {
  kind: 'lecture' | 'lab';
  week: number;
  slug: string;
  href: string;
  code: string;
  title: string;
  summary: string;
  topics: string[];
  meta: string;
  pdf?: { href: string; label: string; pages: number };
};

export const wirelessModule = {
  slug: 'wireless',
  title: 'Wireless Networks',
  leader: { name: 'Dr. Nayera Youness', email: 'nayera.youness@bue.edu.eg', office: 'H-226' },
  color: '#63e6ff',
};

export const lectures: ModuleItem[] = [
  {
    kind: 'lecture', week: 1, slug: 'lecture-01', href: '/wireless/lectures/lecture-01', code: 'Lecture 1',
    title: 'Wireless communication',
    summary: 'Fundamentals of wireless signals and networks: why wireless, the spectrum, network types, and how waves carry information.',
    topics: ['Tx → channel → Rx', 'Spectrum bands', 'Network classification', 'λ = c / f', 'Modulation'],
    meta: '25 slides · 24 interactive sections',
    pdf: { href: '/wireless/lecture-01/WN_Lecture_1.pdf', label: 'WN_Lecture_1.pdf', pages: 25 },
  },
];

export const labs: ModuleItem[] = [
  {
    kind: 'lab', week: 6, slug: 'sheet-3', href: '/wireless/labs/sheet-3', code: 'Sheet 3',
    title: 'Antennas & propagation',
    summary: 'Ten guided questions with checked numerical answers, step-by-step solutions, 21 formulas and a live Friis calculator.',
    topics: ['Antennas', 'Fading', 'Doppler', 'Path loss', 'Friis'],
    meta: '10 questions · step by step',
  },
];

/** Items grouped by week, in week order. */
export const byWeek = (items: ModuleItem[]) =>
  [...new Set(items.map((i) => i.week))].sort((a, b) => a - b).map((week) => ({ week, items: items.filter((i) => i.week === week) }));

/** A PDF link that opens at a page (supported by Chrome, Edge, Firefox and Safari's built-in viewers). */
export const pdfAt = (href: string, page: number) => `${href}#page=${page}`;
