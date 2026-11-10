/**
 * The public attendance API that Lab 5 teaches students to call (POST /api/attendance, GET /api/attendance/status).
 * A check-in is saved as the lab's attendance in the course database: the same list TAs see on /admin.
 * The API is open to any page (CORS): students call it from their phones, from Expo web and from the
 * in-browser previews of the lab and the code editor.
 */
import { noStore } from './server';

/** The lab a check-in counts for when the request does not name one. */
export const ATTENDANCE_LAB = 'lab-05';

export const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

export const apiJson = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...noStore, ...CORS } });

/** The answer to a browser's CORS preflight (sent before a JSON POST from another origin). */
export const preflight = () => new Response(null, { status: 204, headers: CORS });
