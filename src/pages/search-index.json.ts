/**
 * Build-time search index consumed by the command palette (src/scripts/search.ts).
 * Every collection is indexed automatically — new content becomes searchable on the next build.
 */
import { nav, secondaryNav } from '@/site.config';
import { getLabs, getCoursework, getTools, getSetup, getProject, pad, getData } from '@/lib/content';
import { parseLabOutline } from '@/lib/lab';

type Item = { k: string; t: string; d: string; u: string; s?: string; m?: string };
const strip = (md = '') =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^export [\s\S]*?^\];?$/gm, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*_`\[\]()!|{}-]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 2000);

export async function GET() {
  const [labs, coursework, tools, setup, project, commands, troubles, resources, extra] = await Promise.all([
    getLabs(), getCoursework(), getTools(), getSetup(), getProject(),
    getData('commands'), getData('troubleshooting'), getData('resources'), getData('extra'),
  ]);
  const pageDesc: Record<string, string> = {
    '/': 'Course home', '/mobile-development/labs': 'All labs', '/mobile-development/coursework': 'All assignments', '/mobile-development/project': 'Capstone brief',
    '/mobile-development/commands': 'Command handbook', '/mobile-development/tools': 'Development toolkit', '/mobile-development/setup': 'Setup & installation checklist',
    '/mobile-development/resources': 'Docs, tutorials & references', '/mobile-development/troubleshooting': 'Errors & fixes', '/mobile-development/extra': 'Optional material',
  };
  const items: Item[] = [
    ...[...nav, ...secondaryNav].map((n) => ({ k: 'Page', t: n.label, d: pageDesc[n.href] ?? '', u: n.href })),
    ...labs.map((l) => ({
      k: 'Lab', t: `Lab ${pad(l.data.number)} · ${l.data.title}`, d: l.data.description, u: `/mobile-development/labs/${l.id}`,
      m: l.data.difficulty, s: [l.data.skills.join(' '), l.data.objectives.join(' '), l.data.troubleshooting.map((t) => t.problem).join(' '), strip(l.body)].join(' '),
    })),
    // every lab task is searchable on its own ("token", "pull request", "reset project"…)
    ...labs.flatMap((l) =>
      parseLabOutline(l.body).flatMap((p) =>
        p.tasks.map((t) => ({ k: 'Lab', t: `Task ${t.n} · ${t.title}`, d: `Lab ${pad(l.data.number)} — ${p.title}`, u: `/mobile-development/labs/${l.id}#${t.id}`, m: t.time })),
      ),
    ),
    ...coursework.map((c) => ({
      k: 'Coursework', t: `CW${pad(c.data.number)} · ${c.data.title}`, d: c.data.description, u: `/mobile-development/coursework/${c.id}`,
      s: [c.data.objectives.join(' '), c.data.tasks.map((t) => t.title).join(' ')].join(' '),
    })),
    ...(project ? [{ k: 'Project', t: project.data.title, d: project.data.tagline, u: '/mobile-development/project', s: [project.data.description, project.data.features.map((f) => f.name).join(' ')].join(' ') }] : []),
    ...commands.map((c) => ({
      k: 'Command', t: c.data.command, d: c.data.title + ' — ' + c.data.description, u: `/mobile-development/commands#cmd-${c.id}`, m: c.data.category,
      s: [c.data.notes ?? '', c.data.examples.map((e) => e.code).join(' ')].join(' '),
    })),
    ...tools.map((t) => ({ k: 'Tool', t: t.data.name, d: t.data.description, u: `/mobile-development/tools/${t.id}`, m: t.data.category, s: strip(t.body) })),
    ...setup.map((s) => ({ k: 'Setup', t: `Step ${s.data.step} · ${s.data.title}`, d: s.data.summary, u: `/mobile-development/setup/${s.id}`, s: 'install installation ' + strip(s.body) })),
    ...troubles.map((t) => ({ k: 'Troubleshooting', t: t.data.problem, d: t.data.solution, u: `/mobile-development/troubleshooting#${t.id}`, m: t.data.category, s: 'error ' + (t.data.cause ?? '') })),
    ...resources.map((r) => ({ k: 'Resource', t: r.data.title, d: r.data.description ?? r.data.category, u: r.data.href, m: r.data.category })),
    ...extra.map((e) => ({ k: 'Extra', t: e.data.title, d: e.data.summary, u: `/mobile-development/extra#${e.id}`, m: e.data.category })),
  ];
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
}
