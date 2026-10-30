/**
 * Sessions are off: every lab is open to every student at any time, day and night, with no session for a TA to
 * start. Each lab has one permanent session (the server makes it on first use) that records the work, and the TA
 * pages add up every session of a lab. Set to false to bring back sessions that TAs start and end.
 * (Kept apart from core.ts so the browser code can read it without the rest.)
 */
export const ALWAYS_OPEN = true;
/** the permanent session of a lab */
export const OPEN_LAB = { ta: 'Open lab', slot: 'Any time' } as const;
/** the TA pages' choice "every session of this lab, added up" (the default while sessions are off) */
export const ALL_SESSIONS = 'all';
