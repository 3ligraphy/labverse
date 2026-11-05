/** GET /api/progress/mine — the signed-in student's progress in each module, for their home page. */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import { json, studentModules } from '@/lib/progress/server';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const { user } = await access(cookies);
  if (!user || user.role !== 'student' || !user.studentId) return json({ modules: {} });
  try {
    // the same key the labs record under: the student ID in lower case
    return json({ modules: await studentModules(user.studentId.toLowerCase()) });
  } catch (error) {
    console.error('[progress] home progress failed', error);
    return json({ modules: {}, error: 'server' }, 500);
  }
};
