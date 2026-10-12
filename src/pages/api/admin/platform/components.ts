/**
 * Canvas components (permission `platform.settings`; the super admin always has it): which lab components each
 * module's builders see in the lab canvas palette.
 *   GET                                  { kits, nodes: [{ type, kit, label, hint, glyph, color }], presets, faculties,
 *                                          modules: [{ slug, title, code, color, faculty, published, builtIn, nodes: string[] | null }] }
 *   PUT  ?module=… { nodes: string[] | null }   save one module's list (null = every component; Part and Task are always kept)
 * Nodes already in a lab keep working when their type is switched off; builders just can't add new ones.
 */
import type { APIRoute } from 'astro';
import { access } from '@/lib/accounts/access';
import { hubData } from '@/lib/accounts/hub';
import { moduleFaculty } from '@/lib/accounts/core';
import { json } from '@/lib/progress/server';
import { KITS, LAB_NODES, LAB_NODE_TYPES, NODE_PRESETS, compileModule, kitOf, type NodeDef } from '@/lib/platform/core';
import { BUILT_IN_MODULE, ensureBuiltInBuilder, getPlatformStore } from '@/lib/platform/server';

export const prerender = false;

const guard = async (cookies: Parameters<typeof access>[0]) => {
  if (!(await access(cookies)).can('platform.settings')) return { error: json({ error: 'Only the catalogue admin can choose canvas components.' }, 403) };
  const store = getPlatformStore();
  if (!store) return { error: json({ error: 'No database is connected, so components cannot be stored.' }, 503) };
  return { store };
};

export const GET: APIRoute = async ({ cookies }) => {
  const g = await guard(cookies);
  if (g.error) return g.error;
  try {
    await ensureBuiltInBuilder(); // the built-in course has a builder record too
    const [rows, { settings }] = await Promise.all([g.store.listModules(), hubData()]);
    const builtInFaculty = moduleFaculty((settings as { builtIn?: { faculty?: string } }).builtIn?.faculty);
    return json({
      kits: KITS,
      nodes: LAB_NODE_TYPES.map((type) => {
        const d = LAB_NODES[type] as NodeDef;
        return { type, kit: kitOf(type), label: d.label, hint: d.hint, glyph: d.glyph, color: d.color };
      }),
      presets: NODE_PRESETS,
      faculties: settings.faculties.map((f) => ({ slug: f.slug, name: f.name })),
      modules: rows.map((m) => {
        const meta = compileModule(m.flow).meta;
        const builtIn = m.slug === BUILT_IN_MODULE.slug;
        return {
          slug: m.slug, title: meta.title || m.title, code: meta.code ?? '', color: meta.color || (builtIn ? BUILT_IN_MODULE.color : '#7cb1ff'),
          faculty: builtIn ? builtInFaculty : moduleFaculty(meta.faculty), published: m.published, builtIn, nodes: m.labNodes,
        };
      }),
    });
  } catch (error) {
    console.error('[platform] list components failed', error);
    return json({ error: 'Could not load the modules.' }, 500);
  }
};

export const PUT: APIRoute = async ({ cookies, request, url }) => {
  const g = await guard(cookies);
  if (g.error) return g.error;
  const slug = url.searchParams.get('module') ?? '';
  const body = (await request.json().catch(() => null)) as { nodes?: unknown } | null;
  if (!body || !('nodes' in body) || (body.nodes !== null && !Array.isArray(body.nodes))) return json({ error: 'Send { nodes: [...] } or { nodes: null } for every component.' }, 400);
  const nodes = body.nodes === null ? null : (body.nodes as unknown[]).map(String);
  const unknown = nodes?.filter((t) => !LAB_NODE_TYPES.includes(t as never)) ?? [];
  if (unknown.length) return json({ error: `Unknown component${unknown.length === 1 ? '' : 's'}: ${unknown.slice(0, 5).join(', ')}.` }, 400);
  try {
    if (slug === BUILT_IN_MODULE.slug) await ensureBuiltInBuilder();
    const mod = await g.store.setLabNodes(slug, nodes);
    return mod ? json({ module: { slug: mod.slug, nodes: mod.labNodes } }) : json({ error: 'Module not found.' }, 404);
  } catch (error) {
    console.error('[platform] save components failed', error);
    return json({ error: 'Could not save the components.' }, 500);
  }
};
