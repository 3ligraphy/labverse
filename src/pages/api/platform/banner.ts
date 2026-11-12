/** Public, module-scoped active announcement. */
import type { APIRoute } from 'astro';
import { json } from '@/lib/progress/server';
import { SLUG_RE } from '@/lib/platform/core';
import { getPlatformStore } from '@/lib/platform/server';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const module = url.searchParams.get('module') ?? '';
  if (!SLUG_RE.test(module)) return json({ banner: null }, 400);
  const store = getPlatformStore();
  if (!store) return json({ banner: null });
  try {
    const response = json({ banner: await store.publishedBanner(module) });
    response.headers.set('cache-control', 'public, s-maxage=15, stale-while-revalidate=30');
    return response;
  } catch (error) {
    console.error('[platform] public banner failed', error);
    // temporary diagnostic (2026-11-12): the database error behind the missing modules (no secrets in it: code + message)
    const e = error as { code?: unknown; message?: unknown };
    return json({ banner: null, error: { code: e?.code ?? null, message: String(e?.message ?? error).slice(0, 300) } }, 500);
  }
};
