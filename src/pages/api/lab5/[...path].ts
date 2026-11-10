/**
 * The practice API of Lab 5's exercises. Nothing is stored: every answer is computed from fixed sample data, so
 * students can call it as often as they like. Open to any page (CORS) like the attendance API.
 *   GET  /api/lab5/students                 → [{ id, name, studentId, present }]
 *   GET  /api/lab5/students?present=true    → only the present ones (a query string filters)
 *   GET  /api/lab5/students/2               → one student, or 404 { error: 'not-found' }
 *   POST /api/lab5/echo  { …any JSON… }      → 201 { ok: true, received: <your JSON>, at }
 *                        (415 without the Content-Type: application/json header, 400 when the body is not JSON)
 *   anything else                           → 404 { error: 'not-found' }
 */
import type { APIRoute } from 'astro';
import { apiJson as json, preflight } from '@/lib/attendance/api';

export const prerender = false;

export const STUDENTS = [
  { id: 1, name: 'Mona Adel', studentId: '240001', present: true },
  { id: 2, name: 'Omar Khaled', studentId: '240002', present: false },
  { id: 3, name: 'Salma Hassan', studentId: '240003', present: true },
  { id: 4, name: 'Youssef Ali', studentId: '240004', present: true },
  { id: 5, name: 'Nour Samir', studentId: '240005', present: false },
];

const notFound = (path: string) => json({ error: 'not-found', message: `There is no ${path} in the practice API.` }, 404);

export const OPTIONS: APIRoute = () => preflight();

export const GET: APIRoute = ({ params, url }) => {
  const path = String(params.path ?? '');
  if (path === 'students') {
    const present = url.searchParams.get('present');
    const list = present === 'true' ? STUDENTS.filter((s) => s.present) : present === 'false' ? STUDENTS.filter((s) => !s.present) : STUDENTS;
    return json(list);
  }
  const one = /^students\/(\d+)$/.exec(path);
  if (one) {
    const student = STUDENTS.find((s) => s.id === Number(one[1]));
    return student ? json(student) : json({ error: 'not-found', message: `No student has the id ${one[1]}.` }, 404);
  }
  return notFound(`/api/lab5/${path}`);
};

export const POST: APIRoute = async ({ params, request }) => {
  const path = String(params.path ?? '');
  if (path !== 'echo') return notFound(`/api/lab5/${path}`);
  const text = await request.text();
  if (text.length > 20_000) return json({ error: 'too-large', message: 'Send less than 20 KB.' }, 413);
  // like most APIs: the body is read as JSON only when the request says it is JSON
  if (!/application\/json/i.test(request.headers.get('content-type') ?? '')) {
    return json({ error: 'not-json', message: "Add the header 'Content-Type': 'application/json' so the server reads the body as JSON.", receivedText: text.slice(0, 200) }, 415);
  }
  let received: unknown;
  try {
    received = JSON.parse(text);
  } catch {
    return json({ error: 'invalid-json', message: 'The body is not JSON. Did you forget JSON.stringify(…) or the Content-Type header?', receivedText: text.slice(0, 200) }, 400);
  }
  return json({ ok: true, received, at: new Date().toISOString() }, 201);
};
