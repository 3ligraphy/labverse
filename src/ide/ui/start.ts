/**
 * The start screen of BUENOVA Code: choose a language or framework to make a new project (each one comes with a
 * small folder structure and runs with ▶ Run), or open a recent project. Shown at /ide with no project chosen.
 */
import { clear, h, icon } from '../core/dom';
import { WorkspaceFS } from '../core/fs';
import { TEMPLATES, applyTemplate, importZip, type Template } from '../core/project';
import { memo, workspaces } from '../core/settings';
import { applyTheme } from '../core/themes';
import { COURSE_PROJECTS, courseWorkspace, existingCourseWorkspace } from '../core/course-projects';
import { confirmBox } from './widgets';

const open = (id: string) => { location.href = `/ide?ws=${encodeURIComponent(id)}`; };
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(t).toLocaleDateString();
};
const name = (kind?: string) => TEMPLATES.find((t) => t.id === kind)?.name ?? 'Project';

/** Makes the project, fills it with the template, opens its main file, and goes to it. */
async function create(t: Template, title: string) {
  const ws = workspaces.create(title.trim() || `My ${t.name} project`, t.id);
  const fs = new WorkspaceFS(ws.id);
  await applyTemplate(fs, t);
  await fs.flush();
  memo.set(`tabs:${ws.id}`, [{ tabs: [t.open], active: t.open }]);
  open(ws.id);
}

export function renderStart(mount: HTMLElement, user: { name: string } | null) {
  applyTheme();
  document.title = 'BUENOVA Code';
  const recentList = h('div', { class: 'st-recent-list' });
  const paintRecent = () => {
    clear(recentList);
    const all = workspaces.all();
    if (!all.length) { recentList.append(h('p', { class: 'st-dim' }, 'No projects yet. Choose a language on the left to make your first one.')); return; }
    for (const w of all.slice(0, 12)) {
      const t = TEMPLATES.find((x) => x.id === w.kind);
      const row = h('div', { class: 'st-recent', role: 'button', tabIndex: 0, title: `Open ${w.name}` },
        h('span', { class: 'st-dot', style: { background: t?.color ?? 'var(--ide-dim)' } }),
        h('span', { class: 'st-recent-name' }, w.name),
        h('span', { class: 'st-dim' }, `${name(w.kind)} · ${ago(w.opened)}`),
        h('button', { class: 'ide-icon-btn st-del', type: 'button', title: `Delete ${w.name}`, onclick: async (e: Event) => {
          e.stopPropagation();
          if (!(await confirmBox(`Delete the project "${w.name}"?`, 'Its files are removed from this browser. This cannot be undone.', ['Delete'], true))) return;
          workspaces.remove(w.id);
          await WorkspaceFS.destroy(w.id);
          paintRecent();
        } }, icon('trash')));
      row.addEventListener('click', () => open(w.id));
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(w.id); });
      recentList.append(row);
    }
  };

  /** The name box that appears in a card after it is chosen. */
  const ask = (card: HTMLElement, t: Template) => {
    document.querySelectorAll('.st-card.picked').forEach((c) => { if (c !== card) c.classList.remove('picked'); });
    card.classList.add('picked');
    const form = card.querySelector<HTMLFormElement>('form')!;
    const input = form.querySelector('input')!;
    input.value = `My ${t.name} project`;
    requestAnimationFrame(() => { input.focus(); input.select(); });
  };

  const cards = TEMPLATES.map((t) => {
    const form = h('form', { class: 'st-name' },
      h('input', { class: 'ide-input', type: 'text', maxLength: 60, 'aria-label': 'Project name' }),
      h('button', { class: 'ide-btn primary', type: 'submit' }, 'Create'));
    const card = h('div', { class: 'st-card', style: { '--c': t.color } as never },
      h('button', { class: 'st-card-main', type: 'button', onclick: () => ask(card, t) },
        h('span', { class: 'st-card-icon' }, icon(t.iconName)),
        h('span', { class: 'st-card-text' }, h('b', null, t.name), h('span', { class: 'st-tag mono' }, t.tag), h('span', { class: 'st-desc' }, t.description))),
      form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button')!;
      btn.disabled = true;
      btn.textContent = 'Creating…';
      void create(t, form.querySelector('input')!.value);
    });
    form.querySelector('input')!.addEventListener('keydown', (e) => { if (e.key === 'Escape') card.classList.remove('picked'); });
    return card;
  });

  const zip = h('input', { type: 'file', accept: '.zip,application/zip', hidden: true });
  zip.addEventListener('change', async () => {
    const f = zip.files?.[0];
    if (!f) return;
    const ws = workspaces.create(f.name.replace(/\.zip$/i, '') || 'Imported project');
    const fs = new WorkspaceFS(ws.id);
    await importZip(fs, new Uint8Array(await f.arrayBuffer()));
    await fs.flush();
    open(ws.id);
  });

  clear(mount).append(h('div', { class: 'st' },
    h('header', { class: 'st-head' },
      h('a', { class: 'st-back', href: '/' }, '← BUENOVA'),
      h('span', { class: 'st-user st-dim' }, user ? `Signed in as ${user.name}` : 'Your projects are saved in this browser')),
    h('div', { class: 'st-hero' },
      h('div', { class: 'st-logo', 'aria-hidden': 'true' }, 'B'),
      h('div', null, h('h1', null, 'BUENOVA Code'), h('p', { class: 'st-dim' }, 'Choose what you want to build. Everything runs here in your browser: nothing to install. Press ▶ Run to see it.'))),
    h('div', { class: 'st-cols' },
      h('section', { 'aria-label': 'Projects' },
        h('h2', null, 'Lab projects'),
        h('div', { class: 'st-grid st-course' }, COURSE_PROJECTS.map((p) => {
          const tpl = TEMPLATES.find((t) => t.id === p.kind);
          const btn = h('button', { class: 'st-card-main', type: 'button', onclick: async () => {
            btn.disabled = true;
            open(await courseWorkspace(p.id));
          } },
            h('span', { class: 'st-card-icon' }, icon('mortar-board')),
            h('span', { class: 'st-card-text' }, h('b', null, p.title), h('span', { class: 'st-tag mono' }, `${tpl?.name ?? p.kind} · ${existingCourseWorkspace(p.id) ? 'continue' : 'start'}`), h('span', { class: 'st-desc' }, p.description)));
          return h('div', { class: 'st-card', style: { '--c': tpl?.color ?? '#c8ff4d' } as never }, btn);
        })),
        h('h2', { class: 'st-h2-gap' }, 'New project'), h('div', { class: 'st-grid' }, cards)),
      h('section', { 'aria-label': 'Recent projects', class: 'st-side' },
        h('h2', null, 'Recent projects'), recentList,
        h('button', { class: 'ide-btn st-import', type: 'button', onclick: () => zip.click() }, icon('file-zip'), ' Import a project (ZIP)'), zip,
        h('p', { class: 'st-dim st-note' }, 'Mobile apps run in the phone emulator, web apps in a preview, and programs (JavaScript, TypeScript, Python, C++, SQL) in the terminal.'))),
  ));
  paintRecent();
}
