import { moduleSections, moduleSectionHref, PSYCHOLOGY_MODULE } from './module-sections.ts';
import { psychologySetup } from './psychology-guide.ts';
import type { CompiledLab } from './core.ts';
export type SearchItem = { k: string; t: string; d: string; u: string; s?: string; m?: string };

export function moduleSearchItems(slug: string, title: string, labs: { slug: string; compiled: CompiledLab }[], preview = false): SearchItem[] {
  const items: SearchItem[] = moduleSections(slug).map((section) => ({
    k: 'Page', t: section, d: title, u: moduleSectionHref(slug, section, preview),
  }));
  for (const lab of labs) {
    const href = `/m/${encodeURIComponent(slug)}/${encodeURIComponent(lab.slug)}${preview ? '?preview' : ''}`;
    items.push({ k: 'Lab', t: lab.compiled.meta.title, d: lab.compiled.meta.description, u: href, s: lab.compiled.meta.objectives.join(' ') });
    for (const block of lab.compiled.blocks) if (block.kind === 'task') {
      items.push({ k: 'Lab', t: `Task ${block.n} · ${block.title}`, d: lab.compiled.meta.title,
        u: `${href}#task-${block.n.replaceAll('.', '-')}`, s: block.body, m: block.time });
    }
  }
  if (slug === PSYCHOLOGY_MODULE) psychologySetup.forEach((step, i) => items.push({
    k: 'Setup', t: step.title, d: step.check, s: [...step.steps, step.help].join(' '),
    u: `${moduleSectionHref(slug, 'setup', preview)}#setup-${i + 1}`, m: step.time,
  }));
  return items;
}
