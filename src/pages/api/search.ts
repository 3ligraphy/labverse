import type { APIRoute } from 'astro';
import { loadModule } from '@/lib/platform/server';
import { moduleAccess } from '@/lib/accounts/enrolment';
import { isAdmin } from '@/lib/attendance/server';
import { moduleSearchItems } from '@/lib/platform/search';
import { labKey } from '@/lib/platform/core';
import { claimedByFileLab } from '@/lib/lab/claimed';

export const prerender = false;
export const GET: APIRoute = async ({ url, cookies }) => {
  const json = (items: unknown, status = 200) => new Response(JSON.stringify(items), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  const slug = url.searchParams.get('module');
  if (!slug) return json([
    { k: 'Page', t: 'Your modules', d: 'Your learning workspace', u: '/' },
    { k: 'Page', t: 'All modules', d: 'Find a module in the directory', u: '/modules' },
    { k: 'Page', t: 'Your account', d: 'Profile and account settings', u: '/account' },
  ]);
  if (!(await moduleAccess(cookies, slug)).ok) return json([]);
  const preview = isAdmin(cookies) && url.searchParams.has('preview');
  const data = await loadModule(slug, { drafts: preview });
  if (!data) return json([]);
  return json(moduleSearchItems(slug, data.meta.title || data.module.title,
    data.items.filter(({ lab }) => !claimedByFileLab(labKey(slug, lab.slug))).map(({ lab, compiled }) => ({ slug: lab.slug, compiled })), preview));
};
