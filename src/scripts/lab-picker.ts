/**
 * Faculty → Module → Lab picker for the admin dashboards (Sessions, Progress). The lab <select> stays the
 * source of truth (its change event loads the lab); the faculty and module selects only narrow it, and are
 * hidden when there is a single choice. Labs come from /api/admin/progress (`labs`, see labChoices()).
 */
import { rememberAdminModule, savedAdminModule } from './admin-module';

/** The module to open when no lab is chosen yet: ?module=, else the sidebar's remembered module. */
export const startModule = () => new URLSearchParams(location.search).get('module') ?? savedAdminModule();

export type LabChoice = { id: string; title: string; module: string; moduleTitle: string; faculty: string; facultyName: string; href: string };
type Picker = { faculty: HTMLSelectElement | null; module: HTMLSelectElement | null; lab: HTMLSelectElement };

const uniq = <T>(list: T[], key: (v: T) => string) => [...new Map(list.map((v) => [key(v), v])).values()];
const show = (sel: HTMLSelectElement | null, on: boolean) => {
  const box = sel?.closest<HTMLElement>('label') ?? sel;
  if (box) box.hidden = !on;
};

/** Fills the three selects for the current lab. Call after every load; cheap and idempotent. */
export function renderLabPicker(p: Picker, labs: LabChoice[], current: string) {
  const cur = labs.find((l) => l.id === current) ?? labs[0];
  if (!cur) return;
  const faculties = uniq(labs, (l) => l.faculty);
  if (p.faculty) {
    p.faculty.replaceChildren(...faculties.map((f) => new Option(f.facultyName, f.faculty)));
    p.faculty.value = cur.faculty;
    show(p.faculty, faculties.length > 1);
  }
  const modules = uniq(labs.filter((l) => l.faculty === cur.faculty), (l) => l.module);
  if (p.module) {
    p.module.replaceChildren(...modules.map((m) => new Option(m.moduleTitle, m.module)));
    p.module.value = cur.module;
    show(p.module, modules.length > 1 || faculties.length > 1);
  }
  const inModule = labs.filter((l) => l.module === cur.module);
  p.lab.replaceChildren(...inModule.map((l) => new Option(l.title, l.id)));
  p.lab.value = cur.id;
}

/**
 * Changing the faculty or module jumps to its first lab and fires the lab select's change event,
 * so the page loads it exactly as if the lab had been picked by hand. `labs()` returns the latest list.
 */
export function wireLabPicker(p: Picker, labs: () => LabChoice[]) {
  const jump = (pick: (l: LabChoice) => boolean) => {
    const first = labs().find(pick);
    if (!first) return;
    renderLabPicker(p, labs(), first.id);
    // the sidebar's "Managing" module follows (links, remembered choice, ?module= for reloads)
    rememberAdminModule(first.module);
    const url = new URL(location.href);
    url.searchParams.set('module', first.module);
    url.searchParams.delete('lab');
    history.replaceState(history.state, '', url);
    p.lab.dispatchEvent(new Event('change', { bubbles: true }));
  };
  if (p.faculty && !p.faculty.dataset.wired) {
    p.faculty.dataset.wired = '1';
    p.faculty.addEventListener('change', () => jump((l) => l.faculty === p.faculty!.value));
  }
  if (p.module && !p.module.dataset.wired) {
    p.module.dataset.wired = '1';
    p.module.addEventListener('change', () => jump((l) => l.module === p.module!.value));
  }
}
