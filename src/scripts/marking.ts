/**
 * Admin → Marking (Phase 1) in the browser: the group list, the marking form with the grading assistant
 * (questions per criterion → a suggested mark and ready comment sentences), drafts kept in this browser until
 * saved, the Excel / CSV upload (read here, imported by the API), the downloads, the marking load and the summary.
 * The API (src/pages/api/admin/marking) checks every permission again; this file only shows what you may do.
 */
import { CRITERIA, MAX_COMMENT, SECTIONS, TOTAL_MAX, cleanScore, totals, type CriterionId, type Scores } from '@/lib/marking/rubric';
import { HELPERS, LEVELS, RULES, explain, suggest, type Answers, type Question } from '@/lib/marking/assistant';
import { canEdit, myRow, type MarkingDoc, type Marker } from '@/lib/marking/doc';
import { parseMarkingFile, type ParsedRow } from '@/lib/marking/xlsx-read';
import { createProjectPanel, wireAppBuilds } from '@/scripts/project-panel';
import { autoMark, groupsMarkedBy, readEvidence, taPattern, type AutoMark } from '@/lib/marking/automark';

type Group = { number: number; members: { id: string; name: string }[]; idea: string };
type Data = {
  doc: MarkingDoc;
  me: Marker & { row: string | null };
  files: { id: string; title: string }[];
  groups: Group[];
  staff: { name: string; email: string }[];
  changes: { group: number; added: string[]; removed: string[] }[];
  loadSaved: boolean;
};
type Help = Partial<Record<CriterionId, Answers>>;
type Draft = { by: string | null; at: string; scores: Partial<Record<CriterionId, string>>; comment: string; help: Help; manual: CriterionId[] };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '–' : String(Math.round(n * 100) / 100));
const when = (iso: string) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');
const time = (iso: string) => (iso ? new Date(iso).toLocaleTimeString([], { timeStyle: 'short' }) : '');
const crit = (id: CriterionId) => CRITERIA.find((c) => c.id === id)!;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const LEVEL_MARK = { clear: 2, partly: 1, none: 0 } as const;
const CSV_HEADER = 'Group,Actors,Correct logic,Mapping to functional reqs,Functional reqs included,Correct & logical flow,Screens,Pattern selected,Correct implementation in structure,Reasoning,Comments';

/** Drafts: what a TA typed and has not saved yet, in this browser only (gone after Save or Discard). */
const drafts = {
  key: (n: number) => `mk-draft:v1:${n}`,
  get(n: number): Draft | null {
    try {
      const v = localStorage.getItem(this.key(n));
      return v ? (JSON.parse(v) as Draft) : null;
    } catch {
      return null;
    }
  },
  set(n: number, d: Draft) {
    try {
      localStorage.setItem(this.key(n), JSON.stringify(d));
    } catch {
      /* storage full or blocked: the form still works, only without a draft */
    }
  },
  del(n: number) {
    try {
      localStorage.removeItem(this.key(n));
    } catch {
      /* nothing to remove */
    }
  },
};

export function initMarking(root: HTMLElement) {
  let data: Data;
  // every TA sees and may mark every group, so the list opens on All ("My groups" is one click away)
  let filter: 'mine' | 'all' | 'todo' | 'done' = 'all';
  let query = '';
  let preview: ParsedRow[] | null = null;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const msg = $('[data-mk-msg]');
  const say = (text: string, tone: 'ok' | 'err' | '' = '') => {
    msg.textContent = text;
    msg.dataset.tone = tone;
  };

  async function api(body?: object) {
    const r = await fetch('/api/admin/marking', body ? { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({ error: 'The server did not answer.' }));
    if (!r.ok) throw new Error(j.error ?? 'Something went wrong.');
    return j;
  }
  async function load() {
    try {
      data = await api();
      if (!buildsWired) { buildsWired = true; wireAppBuilds($('[data-mk-builds]'), project); }
      render();
    } catch (error) {
      say((error as Error).message, 'err');
    }
  }
  const me = () => data.me as Marker;
  const admin = () => data.me.role === 'admin';
  const editable = (n: number) => canEdit(me(), data.doc, n);
  const mine = () => myRow(data.doc, data.me.email);
  const myGroups = () => {
    const row = mine();
    return row ? data.groups.filter((g) => row.groups.includes(g.number)) : [];
  };
  const taOf = (n: number) => data.doc.tas.find((t) => t.groups.includes(n))?.name ?? '';
  const marksOf = (n: number) => data.doc.marks[String(n)];
  /** the AI button: the group is called in to discuss its project (its students see only the call) */
  const callOf = (n: number) => data.doc.calls?.[String(n)];
  /** everyone who saved the group's marks (part of its marking), first to last */
  const markers = (m: { by: string; editors?: string[] }) => (m.editors?.length ? m.editors : m.by ? [m.by] : []).join(', ');
  /** complete: all 9 marks; started: some marks */
  const isMarked = (n: number) => !!marksOf(n) && totals(marksOf(n)!.scores).missing.length === 0;
  const markCount = (n: number) => (marksOf(n) ? CRITERIA.length - totals(marksOf(n)!.scores).missing.length : 0);
  const exportUrl = (q: Record<string, string>) => `/api/admin/marking/export?${new URLSearchParams(q)}`;

  /* ------------------------------------------------------------------ header */
  function renderHead() {
    const src = $('[data-mk-source]');
    src.innerHTML = admin()
      ? `<label class="mk-src">Group numbers from <select class="input mk-select" data-mk-src>${data.files.map((f) => `<option value="${esc(f.id)}" ${f.id === data.doc.source ? 'selected' : ''}>${esc(f.title)}</option>`).join('')}</select></label>`
      : `<span class="mk-src">Group numbers from <b>${esc(data.files.find((f) => f.id === data.doc.source)?.title ?? '—')}</b></span>`;
    const pub = $<HTMLButtonElement>('[data-mk-publish]');
    pub.hidden = !admin();
    pub.textContent = data.doc.published ? 'Hide marks from students' : 'Publish marks to students';
    pub.setAttribute('aria-pressed', String(data.doc.published));
    const calls = Object.keys(data.doc.calls ?? {}).length;
    $('[data-mk-pubnote]').innerHTML = (data.doc.published
      ? `<b>Published</b>: a student who types their ID on the Project page sees their group’s marks, grade and comments${data.doc.publishedBy ? ` (published by ${esc(data.doc.publishedBy)}, ${esc(when(data.doc.publishedAt))})` : ''}.`
      : 'Not published: students see nothing yet.')
      + (calls ? ` <b>${plural(calls, 'group')} called to discuss</b> (AI): ${calls === 1 ? 'it sees' : 'they see'} only the call, no marks and no feedback.` : '');
    const row = mine();
    $('[data-mk-role]').textContent = admin()
      ? `You are an admin: you can mark every group and change the marking load.${row ? ` Your own groups (${row.name}): ${row.groups.length}.` : ''}`
      : row
        ? `You can mark every group. Your own groups (${row.name}): ${row.groups.length}, under “My groups”. Every save records who made it.`
        : 'You can mark every group; every save records who made it. Your account is not linked to a row of the marking load yet, so “My groups” is empty: ask an admin to link it (Marking load tab).';
    const dl = $('[data-mk-mine-dl]');
    dl.hidden = !row;
    if (row) dl.innerHTML = `Your groups as a sheet to fill offline: <a href="${exportUrl({ mine: '1' })}" download>Excel</a> · <a href="${exportUrl({ mine: '1', format: 'csv' })}" download>CSV</a>`;
  }

  /* ------------------------------------------------------------------ marks tab */
  function visibleGroups() {
    const q = query.toLowerCase();
    const own = new Set(myGroups().map((g) => g.number));
    return data.groups.filter((g) => {
      if (filter === 'mine' && !own.has(g.number)) return false;
      if (filter === 'todo' && isMarked(g.number)) return false;
      if (filter === 'done' && !isMarked(g.number)) return false;
      if (!q) return true;
      return `group ${g.number} g${g.number} ${taOf(g.number)} ${g.idea} ${g.members.map((m) => `${m.name} ${m.id}`).join(' ')}`.toLowerCase().includes(q);
    });
  }
  function renderMarks() {
    const own = myGroups();
    const counts = { mine: own.length, all: data.groups.length, todo: data.groups.filter((g) => !isMarked(g.number)).length, done: data.groups.filter((g) => isMarked(g.number)).length };
    if (filter === 'mine' && !own.length) filter = 'all';
    root.querySelectorAll<HTMLButtonElement>('[data-mk-filter]').forEach((b) => {
      const f = b.dataset.mkFilter as typeof filter;
      b.setAttribute('aria-pressed', String(f === filter));
      b.querySelector('span')!.textContent = String(counts[f]);
      if (f === 'mine') b.hidden = !own.length;
    });
    const changed = new Map(data.changes.map((c) => [c.group, c]));
    const rows = visibleGroups().map((g) => {
      const m = marksOf(g.number);
      const t = m ? totals(m.scores) : null;
      const done = isMarked(g.number);
      const draft = editable(g.number) && drafts.get(g.number)?.by === data.me.email;
      const status = (callOf(g.number) ? '<span class="mk-flag ai">Called to discuss</span> ' : '') + (changed.has(g.number)
        ? '<span class="mk-flag warn">Members changed since marked</span>'
        : done
          ? `<span class="mk-flag ok">Marked${markers(m!) ? ` by ${esc(markers(m!))}` : ''}</span>`
          : markCount(g.number)
            ? `<span class="mk-flag">Started · ${markCount(g.number)} / ${CRITERIA.length}</span>`
            : '<span class="mk-flag">Not marked</span>');
      const call = callOf(g.number);
      const ai = editable(g.number)
        ? `<button type="button" class="mk-ai" data-mk-ai="${g.number}" aria-pressed="${!!call}" aria-label="${call ? `Group ${g.number} is called to discuss. Lift the call` : `Call group ${g.number} to discuss their project`}" title="${call ? `Called to discuss${call.by ? ` by ${esc(call.by)}` : ''}: the students see only the call. Press to lift it.` : 'Call this group to discuss their project: the students see only the call, no marks and no feedback.'}">AI</button>`
        : call ? '<span class="mk-flag ai">AI</span>' : '';
      return `<tr>
        <th scope="row" class="mono">${g.number}</th>
        <td>${esc(taOf(g.number)) || '<span class="faint">—</span>'}</td>
        <td class="mk-members">${g.members.map((x) => esc(x.name)).join(', ')}</td>
        <td class="mk-idea">${esc(g.idea) || '<span class="faint">—</span>'}</td>
        <td class="mono">${done ? fmt(t!.total) : '–'}</td>
        <td>${done ? `<span class="mk-grade" data-g="${t!.grade}">${t!.grade}</span>` : ''}</td>
        <td>${status}${draft ? ' <span class="mk-flag draft">Unsaved draft</span>' : ''}</td>
        <td>${ai}</td>
        <td><button type="button" class="btn btn-sm ${editable(g.number) ? 'btn-primary' : 'btn-ghost'}" data-mk-open="${g.number}">${editable(g.number) ? (m ? 'Edit' : 'Mark') : 'View'}</button></td>
      </tr>`;
    });
    $('[data-mk-rows]').innerHTML = rows.join('') || `<tr><td colspan="9" class="faint">No groups here.</td></tr>`;
  }

  /* ------------------------------------------------------------------ the marking form */
  const dlg = $<HTMLDialogElement>('[data-mk-dlg]');
  const panel = $('[data-mk-assist]');
  const aside = $('[data-mk-aside]');
  const narrow = window.matchMedia('(max-width: 879px)');
  /* the group's project (app, report, hand-in) beside the form; on by default, remembered in this browser */
  const project = createProjectPanel($('[data-mk-proj]'), { item: () => data?.doc.source ?? null });
  const projToggle = $<HTMLButtonElement>('[data-mk-proj-toggle]');
  const projOn = () => dlg.dataset.proj === 'on';
  const setProj = (on: boolean) => {
    dlg.dataset.proj = on ? 'on' : 'off';
    projToggle.setAttribute('aria-pressed', String(on));
    try { localStorage.setItem('mk-proj', on ? 'on' : 'off'); } catch { /* private mode */ }
  };
  setProj((() => { try { return localStorage.getItem('mk-proj') !== 'off'; } catch { return true; } })());
  let buildsWired = false;
  const commentBox = () => $<HTMLTextAreaElement>('[data-mk-comment]');
  const inputOf = (id: CriterionId) => root.querySelector<HTMLInputElement>(`[data-mk-in="${id}"]`)!;
  let current = 0;
  let active: CriterionId = 'uc_actors';
  /** the assistant's answers per criterion (saved with the marks) */
  let help: Help = {};
  /** criteria whose mark the TA typed: the assistant suggests but does not overwrite them */
  let manual = new Set<CriterionId>();
  /** the sentences the assistant put in the comment, per criterion; sentences the TA removed stay out */
  let auto = new Map<CriterionId, string[]>();
  let dismissed = new Set<string>();
  let draftTimer = 0;

  const average = (id: CriterionId, groups?: readonly number[]) => {
    const vals = (groups ? groups.map((g) => marksOf(g)) : Object.values(data.doc.marks)).map((m) => m?.scores[id]).filter((v): v is number => typeof v === 'number');
    return vals.length ? { avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100, n: vals.length } : null;
  };

  function openGroup(n: number) {
    current = n;
    const g = data.groups.find((x) => x.number === n)!;
    const m = marksOf(n);
    const can = editable(n);
    const draft = can ? drafts.get(n) : null;
    const use = draft && draft.by === data.me.email ? draft : null;
    help = JSON.parse(JSON.stringify(use?.help ?? m?.help ?? {})) as Help;
    const change = data.changes.find((c) => c.group === n);
    $('[data-mk-d-title]').textContent = `Group ${n}${g.idea ? ` · ${g.idea}` : ''}`;
    $('[data-mk-d-meta]').innerHTML = `${esc(taOf(n)) ? `TA: <b>${esc(taOf(n))}</b> · ` : ''}${g.members.map((x) => `${esc(x.name)} <span class="mono faint">${esc(x.id)}</span>`).join(' · ')}${change ? `<br><span class="mk-flag warn">Members changed since it was marked: +${change.added.length} / −${change.removed.length}. Check the group before you save.</span>` : ''}${m?.at ? `<br><span class="faint">Last saved ${esc(when(m.at))}${m.by ? ` by ${esc(m.by)}` : ''}${(m.editors?.length ?? 0) > 1 ? ` · marked by ${esc(markers(m))}` : ''}</span>` : ''}${can && taOf(n) && taOf(n) !== mine()?.name ? `<br><span class="mk-flag">This is ${esc(taOf(n))}’s group. You can change it: your save is recorded and your name is added to “Marked by”.</span>` : ''}<span data-mk-d-call></span>`;
    showCall(n);
    aside.append(panel);
    $('[data-mk-form]').innerHTML = SECTIONS.map((s) => `
      <fieldset class="mk-sec">
        <legend><span>${esc(s.title)}</span><span class="mono" data-mk-sub="${s.id}"></span></legend>
        ${CRITERIA.filter((c) => c.section === s.id).map((c) => {
          const avg = average(c.id);
          const value = use ? use.scores[c.id] ?? '' : m?.scores[c.id] ?? '';
          return `
          <div class="mk-crit" data-mk-row="${c.id}">
            <label class="mk-crit-l" for="mk-in-${c.id}">${esc(c.label)}<small class="faint">${avg ? `class avg ${fmt(avg.avg)}` : ''}</small><small class="mk-auto-tag" data-mk-tag="${c.id}" hidden></small></label>
            <span class="mk-crit-in">
              <input id="mk-in-${c.id}" class="input mono" type="text" inputmode="decimal" autocomplete="off" data-mk-in="${c.id}" value="${esc(value)}" ${can ? '' : 'disabled'} aria-label="${esc(c.label)}, out of ${c.max}" />
              <span class="mono faint">/ ${c.max}</span>
              <button type="button" class="mk-pick" data-mk-pick="${c.id}" aria-label="Grading assistant for ${esc(c.label)}" title="Grading assistant">?</button>
            </span>
          </div>`;
        }).join('')}
      </fieldset>`).join('');
    const box = commentBox();
    box.value = use ? use.comment : m?.comment ?? '';
    box.disabled = !can;
    box.maxLength = MAX_COMMENT;
    // typed marks stay the TA's own; marks the assistant gave follow its answers
    manual = new Set(
      use
        ? use.manual
        : CRITERIA.filter((c) => {
            const v = m?.scores[c.id];
            return typeof v === 'number' && (!help[c.id] || suggest(c.id, help[c.id]!) !== v);
          }).map((c) => c.id),
    );
    const lines = new Set(box.value.split('\n').map((l) => l.trim()));
    auto = new Map(CRITERIA.filter((c) => help[c.id]).map((c) => [c.id, explain(c.id, help[c.id]!).filter((x) => lines.has(`• ${x}`))]));
    dismissed = new Set();
    root.querySelectorAll<HTMLButtonElement>('[data-mk-save], [data-mk-save-next], [data-mk-full]').forEach((b) => (b.hidden = !can));
    renderAutoBox(n, can);
    $('[data-mk-ro]').hidden = can;
    $('[data-mk-hint]').hidden = !can;
    const bar = $('[data-mk-draft]');
    bar.hidden = !use;
    if (use) bar.innerHTML = `Your unsaved changes from ${esc(when(use.at))} are back. <button type="button" class="mk-link" data-mk-discard>Discard them</button>`;
    $('[data-mk-d-msg]').textContent = '';
    active = CRITERIA.find((c) => cleanScore(inputOf(c.id).value, c.max) === null)?.id ?? 'uc_actors';
    updateTotals();
    renderAssist();
    if (!dlg.open) dlg.showModal();
    dlg.style.setProperty('--mk-head', `${$('.mk-d-head').offsetHeight}px`);
    if (projOn()) void project.show(n);
    (root.querySelector<HTMLInputElement>('[data-mk-in]:not([disabled])') ?? $('[data-mk-close]')).focus({ preventScroll: true });
  }
  /* ------------------------------------------------------------------ auto-mark */
  /**
   * The Auto-mark box: whose way of marking to follow (the group's TA by default, when they have marked groups;
   * else yours; else the TA with the most), or the whole class.
   */
  function renderAutoBox(n: number, can: boolean) {
    $('[data-mk-autobox]').hidden = !can;
    const msgEl = $('[data-mk-auto-msg]');
    msgEl.hidden = true;
    msgEl.textContent = '';
    if (!can) return;
    const counts = data.doc.tas.map((t) => ({ name: t.name, n: groupsMarkedBy(data.doc, t).filter((g) => g !== n).length }));
    const pick = [taOf(n), mine()?.name ?? ''].find((name) => counts.some((c) => c.name === name && c.n > 0)) ?? [...counts].sort((a, b) => b.n - a.n).find((c) => c.n > 0)?.name ?? '';
    $('[data-mk-auto-ta]').innerHTML = `${counts.map((c) => `<option value="${esc(c.name)}" ${c.name === pick ? 'selected' : ''}>${esc(c.name)} (${plural(c.n, 'group')} marked)</option>`).join('')}<option value="" ${pick ? '' : 'selected'}>the whole class</option>`;
  }
  const SOURCE_TAG: Record<AutoMark['source'], string> = { answers: 'auto · your answers', evidence: 'auto · from the hand-in', pattern: 'auto · TA pattern', class: 'auto · class pattern' };
  function tag(id: CriterionId, a: AutoMark | null) {
    const el = root.querySelector<HTMLElement>(`[data-mk-tag="${id}"]`);
    if (!el) return;
    el.hidden = !a;
    el.textContent = a ? SOURCE_TAG[a.source] : '';
    el.title = a ? `Why ${fmt(a.value)}: ${a.note}` : '';
    el.dataset.source = a?.source ?? '';
  }
  /**
   * Auto-mark: reads the hand-in (report text and app code), turns what it shows into assistant answers, and fills
   * every EMPTY mark the way the chosen TA marks (src/lib/marking/automark.ts). Typed marks stay; nothing is saved.
   */
  async function autoFill() {
    const n = current;
    if (!n || !editable(n)) return;
    const btn = $<HTMLButtonElement>('[data-mk-auto]');
    const msgEl = $('[data-mk-auto-msg]');
    btn.disabled = true;
    msgEl.hidden = false;
    msgEl.dataset.tone = '';
    msgEl.textContent = 'Reading the hand-in: the report and the app’s code…';
    try {
      const ev = await project.evidence(n).catch(() => null);
      if (current !== n || !dlg.open) return;
      const evidence = ev ? readEvidence(ev.report, ev.files) : { answers: {}, found: {} };
      const who = $<HTMLSelectElement>('[data-mk-auto-ta]').value;
      const ta = data.doc.tas.find((t) => t.name === who) ?? null;
      const name = ta?.name ?? 'the class';
      const own = taPattern(data.doc, ta, n);
      const r = autoMark(evidence, help, own, taPattern(data.doc, null, n), name);
      const filled: AutoMark[] = [];
      let kept = 0;
      for (const c of CRITERIA) {
        if (r.help[c.id]) help[c.id] = r.help[c.id];
        const a = r.marks[c.id];
        if (!a) continue;
        if (inputOf(c.id).value.trim()) { kept++; continue; }
        setMark(c.id, a.value);
        manual.delete(c.id);
        filled.push(a);
        tag(c.id, a);
      }
      for (const c of CRITERIA) if (r.help[c.id]) syncComment(c.id);
      updateTotals();
      renderAssist();
      saveDraft();
      const fromHandIn = filled.filter((a) => a.source === 'evidence' || a.source === 'answers').length;
      const fromPattern = filled.length - fromHandIn;
      const missing = CRITERIA.filter((c) => !inputOf(c.id).value.trim()).map((c) => c.label);
      const notRead = ev?.notes.length ? ` Not read: ${ev.notes.join('; ')}.` : ev ? '' : ' The hand-in could not be loaded.';
      msgEl.dataset.tone = filled.length ? 'ok' : '';
      msgEl.textContent = filled.length
        ? `Filled ${plural(filled.length, 'mark')} like ${name}${ta ? ` (learned from ${plural(own.groups.length, 'marked group')})` : ''}: ${fromHandIn} from what the hand-in shows, ${fromPattern} from ${ta ? `${name}’s` : 'the'} usual marks.${kept ? ` ${plural(kept, 'mark')} already in the form ${kept === 1 ? 'was' : 'were'} kept.` : ''}${missing.length ? ` Still empty: ${missing.join(', ')}.` : ''}${notRead} Hover an “auto” tag to see why, check every mark, then save.`
        : kept === CRITERIA.length
          ? 'Every mark is already filled in: empty a mark to let Auto-mark fill it.'
          : `Nothing to fill yet: ${ta ? `${name} has` : 'the class has'} too few marked groups and the hand-in showed nothing that decides a mark.${notRead} Mark a few groups first: Auto-mark learns from them.`;
    } catch (error) {
      msgEl.dataset.tone = 'err';
      msgEl.textContent = `Auto-mark did not work: ${(error as Error).message}`;
    } finally {
      btn.disabled = false;
    }
  }

  /** The dialog's AI button and its line under the members, for group n. */
  function showCall(n: number) {
    const call = callOf(n);
    const btn = $<HTMLButtonElement>('[data-mk-ai-d]');
    btn.hidden = !editable(n);
    btn.setAttribute('aria-pressed', String(!!call));
    btn.textContent = call ? 'AI: called to discuss' : 'AI: call to discuss';
    btn.title = call
      ? 'Press to lift the call: the students see their marks and feedback again once marks are published.'
      : 'Call this group to discuss their project: the students see only the call, no marks and no feedback.';
    const line = root.querySelector('[data-mk-d-call]');
    if (line) line.innerHTML = call ? `<br><span class="mk-flag ai">Called to discuss${call.by ? ` by ${esc(call.by)}` : ''}${call.at ? `, ${esc(when(call.at))}` : ''}: the students see only the call, no marks and no feedback.</span>` : '';
  }
  function formScores(): Scores {
    const s: Scores = {};
    root.querySelectorAll<HTMLInputElement>('[data-mk-in]').forEach((i) => {
      const c = crit(i.dataset.mkIn as CriterionId);
      const v = cleanScore(i.value, c.max);
      if (v !== null) s[c.id] = v;
    });
    return s;
  }
  function updateTotals() {
    const t = totals(formScores());
    for (const s of SECTIONS) $(`[data-mk-sub="${s.id}"]`).textContent = `${fmt(t.sections[s.id])} / ${s.max}`;
    const done = data.groups.filter((g) => g.number !== current && isMarked(g.number));
    const classAvg = done.length ? done.reduce((a, g) => a + totals(marksOf(g.number)!.scores).total, 0) / done.length : null;
    $('[data-mk-total]').innerHTML = !t.grade
      ? 'No marks yet'
      : t.missing.length
        ? `<b>${fmt(t.total)}</b> / ${TOTAL_MAX} so far · the grade shows when all ${CRITERIA.length} marks are in`
        : `<b>${fmt(t.total)}</b> / ${TOTAL_MAX} · ${fmt(t.percent)} / 100 · grade <span class="mk-grade" data-g="${t.grade}">${t.grade}</span>${classAvg !== null ? ` <span class="faint small">· class average ${fmt(classAvg)} / ${TOTAL_MAX}</span>` : ''}`;
    const warn: string[] = [];
    if (t.missing.length && t.missing.length < CRITERIA.length) warn.push(`${t.missing.length} mark${t.missing.length === 1 ? '' : 's'} still empty: ${t.missing.map((id) => crit(id).label).join(', ')}.`);
    root.querySelectorAll<HTMLInputElement>('[data-mk-in]').forEach((i) => {
      const c = crit(i.dataset.mkIn as CriterionId);
      const raw = i.value.trim();
      const v = cleanScore(raw, c.max);
      const bad = raw !== '' && (v === null || Number(raw.replace(',', '.')) !== v);
      i.setAttribute('aria-invalid', String(bad));
      if (bad) warn.push(`${c.label}: “${raw}” is saved as ${v === null ? 'empty' : v} (0 to ${c.max}).`);
      i.closest('.mk-crit')?.toggleAttribute('data-active', c.id === active);
    });
    if (!commentBox().value.trim() && !t.missing.length) warn.push('The comment is empty: students learn most from it.');
    $('[data-mk-warn]').innerHTML = warn.map((w) => `<li>${esc(w)}</li>`).join('');
    $('[data-mk-count]').textContent = `${commentBox().value.length} / ${MAX_COMMENT}`;
  }

  /* ------------------------------------------------------------------ the grading assistant */
  function question(q: Question, a: Answers, dis: string) {
    const id = `mk-q-${active}-${q.key}`;
    if (q.kind === 'count') return `<label class="mk-q" for="${id}"><span>${esc(q.label)}</span><input id="${id}" class="input mono" type="number" min="0" max="${q.max}" step="1" inputmode="numeric" data-mk-q="${q.key}" data-kind="count" value="${esc(a[q.key] ?? '')}" ${dis} /></label>`;
    if (q.kind === 'yes') return `<label class="mk-q mk-q-yes"><input type="checkbox" data-mk-q="${q.key}" data-kind="yes" ${a[q.key] === true ? 'checked' : ''} ${dis} /><span>${esc(q.label)}</span><span class="mono faint">${q.deduction ? `−${q.deduction}` : 'note'}</span></label>`;
    return `<fieldset class="mk-q mk-q-level"><legend>${esc(q.label)}</legend><div class="mk-seg">${LEVELS.map((l) => `<label><input type="radio" name="mk-q-${active}" value="${l}" data-mk-q="${q.key}" data-kind="level" ${a[q.key] === l ? 'checked' : ''} ${dis} /><span>${esc(q.options[l])}<b class="mono">${LEVEL_MARK[l]}</b></span></label>`).join('')}</div></fieldset>`;
  }
  function renderAssist() {
    const c = crit(active);
    const i = CRITERIA.findIndex((x) => x.id === active);
    const section = SECTIONS.find((s) => s.id === c.section)!;
    const dis = editable(current) ? '' : 'disabled';
    const cls = average(active);
    const own = mine() ? average(active, mine()!.groups.filter((g) => g !== current)) : null;
    panel.innerHTML = `
      <div class="mk-as-nav">
        <button type="button" class="mk-step" data-mk-step="-1" ${i === 0 ? 'disabled' : ''} aria-label="Previous criterion">←</button>
        <div><p class="mk-as-k mono">${i + 1} / ${CRITERIA.length} · ${esc(section.title)}</p><p class="mk-as-t">${esc(c.label)} <span class="mono faint">/ ${c.max}</span></p></div>
        <button type="button" class="mk-step" data-mk-step="1" ${i === CRITERIA.length - 1 ? 'disabled' : ''} aria-label="Next criterion">→</button>
      </div>
      <p class="mk-rule small">${esc(RULES[active])}</p>
      <div class="mk-qs">${HELPERS[active].map((q) => question(q, help[active] ?? {}, dis)).join('')}</div>
      <div class="mk-as-out" aria-live="polite" data-mk-out></div>
      <div data-mk-say></div>
      <p class="mk-as-avg small faint">${cls ? `Class average ${fmt(cls.avg)} / ${c.max} (${plural(cls.n, 'group')})` : 'No marks for this yet in the class.'}${own ? ` · your groups ${fmt(own.avg)}` : ''}</p>`;
    renderOut();
    placePanel();
    updateTotals();
  }
  /** the suggestion and the sentences only, so typing in a question keeps its focus */
  function renderOut() {
    const c = crit(active);
    const a = help[active] ?? {};
    const s = suggest(active, a);
    const now = cleanScore(inputOf(active).value, c.max);
    $('[data-mk-out]').innerHTML =
      s === null
        ? '<span class="faint">Answer the questions to get a suggested mark.</span>'
        : now === s
          ? `<span>Suggested <b class="mono">${fmt(s)}</b> / ${c.max}</span><span class="mk-flag ok">In the form</span>`
          : `<span>Suggested <b class="mono">${fmt(s)}</b> / ${c.max}</span>${editable(current) ? `<button type="button" class="btn btn-primary btn-sm" data-mk-use>Use ${fmt(s)}</button>` : ''}${now !== null ? `<span class="small faint">The form has ${fmt(now)}${manual.has(active) ? ' (typed by you, kept until you press Use)' : ''}.</span>` : ''}`;
    const say = explain(active, a).filter((x) => !dismissed.has(x));
    $('[data-mk-say]').innerHTML = say.length ? `<p class="mk-chk-h">In the comment</p><ul class="mk-say">${say.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  }
  /** desktop: the assistant sits beside the form; phones, or with the project open: right under the criterion it is about */
  function placePanel() {
    if (narrow.matches || projOn()) root.querySelector(`[data-mk-row="${active}"]`)?.after(panel);
    else if (panel.parentElement !== aside) aside.append(panel);
  }
  function select(id: CriterionId) {
    if (id === active && panel.innerHTML) return;
    active = id;
    renderAssist();
  }
  function setMark(id: CriterionId, v: number) {
    inputOf(id).value = String(v);
  }
  function answer(key: string, value: Answers[string]) {
    const a = { ...(help[active] ?? {}) };
    if (value === undefined || value === '' || (typeof value === 'number' && !Number.isFinite(value))) delete a[key];
    else a[key] = value;
    if (Object.keys(a).length) help[active] = a;
    else delete help[active];
    const s = suggest(active, a);
    if (s !== null && !manual.has(active)) setMark(active, s);
    syncComment(active);
    updateTotals();
    renderOut();
    saveDraft();
  }
  /**
   * The comment keeps the TA's own lines first, then the assistant's sentences in rubric order. A sentence the TA
   * deleted or rewrote is not added again.
   */
  function syncComment(changed?: CriterionId) {
    const box = commentBox();
    const lines = box.value.split('\n');
    const present = new Set(lines.map((l) => l.trim()));
    const ours = new Set<string>();
    for (const [id, list] of auto) {
      const kept = list.filter((x) => present.has(`• ${x}`));
      for (const x of list) if (!kept.includes(x)) dismissed.add(x);
      for (const x of kept) ours.add(`• ${x}`);
      auto.set(id, kept);
    }
    if (changed) auto.set(changed, explain(changed, help[changed] ?? {}).filter((x) => !dismissed.has(x)));
    const own = lines.filter((l) => !ours.has(l.trim()));
    while (own.length && !own[own.length - 1].trim()) own.pop();
    const ownSet = new Set(own.map((l) => l.trim()));
    const add: string[] = [];
    for (const c of CRITERIA) for (const x of auto.get(c.id) ?? []) if (!ownSet.has(`• ${x}`) && !add.includes(`• ${x}`)) add.push(`• ${x}`);
    box.value = [...own, ...add].join('\n').slice(0, MAX_COMMENT);
  }

  /* ------------------------------------------------------------------ drafts, save */
  function snapshot(): Draft {
    const scores: Draft['scores'] = {};
    root.querySelectorAll<HTMLInputElement>('[data-mk-in]').forEach((i) => {
      if (i.value.trim()) scores[i.dataset.mkIn as CriterionId] = i.value.trim();
    });
    return { by: data.me.email, at: new Date().toISOString(), scores, comment: commentBox().value, help, manual: [...manual] };
  }
  function writeDraft() {
    window.clearTimeout(draftTimer);
    if (!current || !editable(current)) return;
    const m = marksOf(current);
    const s = formScores();
    const same = CRITERIA.every((c) => s[c.id] === m?.scores[c.id]) && commentBox().value.trim() === (m?.comment ?? '').trim();
    if (same) drafts.del(current);
    else drafts.set(current, snapshot());
  }
  function saveDraft() {
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(writeDraft, 300);
  }
  function nextGroup(): number | null {
    const list = visibleGroups().map((g) => g.number).filter(editable);
    const i = list.indexOf(current);
    return [...list.slice(i + 1), ...list.slice(0, Math.max(0, i))].find((n) => !isMarked(n) && n !== current) ?? null;
  }
  async function save(next = false) {
    const btns = root.querySelectorAll<HTMLButtonElement>('[data-mk-save], [data-mk-save-next]');
    btns.forEach((b) => (b.disabled = true));
    window.clearTimeout(draftTimer);
    const saved = current;
    try {
      const j = await api({ action: 'marks', group: saved, scores: formScores(), comment: commentBox().value, help });
      data.doc = j.doc;
      drafts.del(saved);
      data.changes = data.changes.filter((c) => c.group !== saved);
      renderMarks();
      renderSummary();
      if (next) {
        const n = nextGroup();
        if (n === null) {
          dlg.close();
          say(`Saved group ${saved}. Every group in this list is marked.`, 'ok');
        } else {
          openGroup(n);
          $('[data-mk-d-msg]').textContent = `Saved group ${saved}.`;
        }
      } else $('[data-mk-d-msg]').textContent = `Saved ${time(new Date().toISOString())}.`;
    } catch (error) {
      $('[data-mk-d-msg]').textContent = (error as Error).message;
    } finally {
      btns.forEach((b) => (b.disabled = false));
    }
  }

  /* ------------------------------------------------------------------ upload */
  const hasData = (r: ParsedRow) => Object.keys(r.scores).length > 0 || r.comment !== '';
  function showPreview(rows: ParsedRow[], warnings: string[], file: string) {
    preview = rows;
    const box = $('[data-mk-preview]');
    const known = new Set(data.groups.map((g) => g.number));
    const withData = rows.filter(hasData);
    const ok = (r: ParsedRow) => known.has(r.group) && editable(r.group);
    const lines = withData.map((r) => {
      const after = totals({ ...(ok(r) ? marksOf(r.group)?.scores : {}), ...r.scores });
      const count = CRITERIA.length - after.missing.length;
      const why = !known.has(r.group) ? 'Not a group of this item: skipped' : !editable(r.group) ? 'Only TAs and admins can mark: skipped' : marksOf(r.group) ? `Updates the saved marks${marksOf(r.group)!.by ? ` (last saved by ${marksOf(r.group)!.by})` : ''}` : 'New';
      return `<tr><th scope="row" class="mono">${r.group}</th><td>${esc(r.ta) || '<span class="faint">—</span>'}</td><td class="mono">${Object.keys(r.scores).length} / ${CRITERIA.length}</td><td class="mono">${!ok(r) || !after.grade ? '–' : after.missing.length ? `${fmt(after.total)} so far` : `${fmt(after.total)} <span class="mk-grade" data-g="${after.grade}">${after.grade}</span>`}</td><td>${r.comment ? 'Yes' : '<span class="faint">—</span>'}</td><td>${esc(why)}${ok(r) && count < CRITERIA.length ? ` <span class="mk-flag">${count} / ${CRITERIA.length} marks after import</span>` : ''}</td></tr>`;
    });
    const importable = withData.filter(ok).length;
    box.hidden = false;
    box.innerHTML = `
      <p><b>${esc(file)}</b>: ${plural(withData.length, 'group')} with marks or comments · <b>${importable}</b> you can import${rows.length > withData.length ? ` · ${rows.length - withData.length} still empty` : ''}. Empty cells keep the saved marks.</p>
      ${warnings.length ? `<ul class="mk-warn mk-warn-box">${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      ${lines.length ? `<div class="mk-tablewrap"><table class="mk-table"><thead><tr><th>Group</th><th>TA in the file</th><th>Marks</th><th>Total after</th><th>Comment</th><th>What happens</th></tr></thead><tbody>${lines.join('')}</tbody></table></div>` : ''}
      ${admin() && rows.some((r) => r.ta) ? '<label class="mk-loadchk"><input type="checkbox" data-mk-useload /> Also set the marking load from this file’s “Assigned TA” column</label>' : ''}
      <div class="mk-actions"><button type="button" class="btn btn-primary btn-sm" data-mk-import ${importable ? '' : 'disabled'}>Import ${plural(importable, 'group')}</button><button type="button" class="btn btn-ghost btn-sm" data-mk-cancel>Cancel</button></div>`;
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  async function readFile(f: File) {
    try {
      if (f.size > 5 * 1024 * 1024) throw new Error('This file is too big (over 5 MB) for a marking sheet.');
      const out = parseMarkingFile(new Uint8Array(await f.arrayBuffer()), f.name);
      if (!out.rows.length) throw new Error(out.warnings[0] ?? 'No marking rows were found in this file.');
      say('');
      showPreview(out.rows, out.warnings, f.name);
    } catch (error) {
      say((error as Error).message, 'err');
    }
  }
  async function doImport() {
    if (!preview) return;
    const btn = $<HTMLButtonElement>('[data-mk-import]');
    btn.disabled = true;
    try {
      if (root.querySelector<HTMLInputElement>('[data-mk-useload]')?.checked) {
        const j = await api({ action: 'load-rows', rows: preview.map((r) => ({ group: r.group, ta: r.ta })) });
        data.doc = j.doc;
      }
      const rows = preview.filter(hasData).map((r) => ({ group: r.group, ta: r.ta, scores: r.scores, comment: r.comment }));
      const j = await api({ action: 'import', rows });
      data.doc = j.doc;
      const skipped = j.skipped as { group: number; reason: string }[];
      say(`Imported ${plural(j.imported.length, 'group')}${j.imported.length ? ` (${j.imported.join(', ')})` : ''}.${skipped.length ? ` Skipped ${skipped.length}: ${skipped.map((s) => s.group).join(', ')} (not in this item, or empty).` : ''}`, 'ok');
      preview = null;
      $('[data-mk-preview]').hidden = true;
      render();
    } catch (error) {
      say((error as Error).message, 'err');
      btn.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ marking load */
  function renderLoad() {
    const all = data.groups.map((g) => g.number);
    const known = new Set(all);
    const count = new Map<number, number>();
    for (const t of data.doc.tas) for (const g of t.groups) count.set(g, (count.get(g) ?? 0) + 1);
    const none = all.filter((g) => !count.get(g));
    const twice = [...count].filter(([, c]) => c > 1).map(([g]) => g);
    const extra = [...count.keys()].filter((g) => !known.has(g)).sort((a, b) => a - b);
    const account = (email: string | null) => (email ? data.staff.find((s) => s.email === email)?.name ?? email : null);
    const rows = data.doc.tas.map((t, i) => {
      const marked = t.groups.filter(isMarked).length;
      const linkedElsewhere = t.email && !data.staff.some((s) => s.email === t.email);
      return `<tr>
        <td>${admin() ? `<input class="input" data-mk-ta-name="${i}" value="${esc(t.name)}" aria-label="TA name" />` : esc(t.name)}</td>
        <td>${admin() ? `<select class="input mk-select" data-mk-ta-email="${i}" aria-label="Account of ${esc(t.name)}"><option value="">— not linked —</option>${linkedElsewhere ? `<option value="${esc(t.email)}" selected>${esc(t.email)} (not an active staff account)</option>` : ''}${data.staff.map((s) => `<option value="${esc(s.email)}" ${s.email === t.email ? 'selected' : ''}>${esc(s.name)} · ${esc(s.email)}</option>`).join('')}</select>` : t.email ? esc(account(t.email)) : '<span class="faint">not linked</span>'}</td>
        <td>${admin() ? `<input class="input mono" data-mk-ta-groups="${i}" value="${esc(t.groups.join(', '))}" aria-label="Groups of ${esc(t.name)}" />` : `<span class="mono">${esc(t.groups.join(', '))}</span>`}</td>
        <td class="mono">${t.groups.length}</td>
        <td><div class="mk-meter" title="${marked} of ${t.groups.length} marked"><i style="--w:${t.groups.length ? (marked / t.groups.length) * 100 : 0}%"></i></div><span class="mono faint">${marked} / ${t.groups.length}</span></td>
        <td class="mk-dl"><a href="${exportUrl({ ta: t.name })}" download>Excel</a> · <a href="${exportUrl({ ta: t.name, format: 'csv' })}" download>CSV</a></td>
        ${admin() ? `<td><button type="button" class="btn btn-ghost btn-sm" data-mk-ta-del="${i}" aria-label="Remove ${esc(t.name)}">Remove</button></td>` : ''}
      </tr>`;
    });
    $('[data-mk-load]').innerHTML = `
      <p class="mk-note">${data.loadSaved ? 'The marking load as saved by an admin.' : 'The team’s marking load (from the TA list) is in use. It is saved with the first marks or when an admin saves it here.'} Each row is linked to a staff account by first name when exactly one account has that name; an admin can change the link.</p>
      <div class="mk-tablewrap"><table class="mk-table mk-loadt">
        <thead><tr><th>TA</th><th>Account</th><th>Groups</th><th>Count</th><th>Marked</th><th>Sheet</th>${admin() ? '<th></th>' : ''}</tr></thead>
        <tbody>${rows.join('') || `<tr><td colspan="7" class="faint">No marking load yet. ${admin() ? 'Add the TAs here.' : 'An admin sets it.'}</td></tr>`}</tbody>
      </table></div>
      ${admin() ? '<div class="mk-actions"><button type="button" class="btn btn-ghost btn-sm" data-mk-ta-add>Add a TA</button><button type="button" class="btn btn-primary btn-sm" data-mk-ta-save>Save the marking load</button></div>' : ''}
      ${none.length ? `<p class="mk-flag warn">Groups with no TA: ${none.join(', ')}</p>` : data.doc.tas.length ? `<p class="mk-flag ok">Every group (${all.length}) has a TA.</p>` : ''}
      ${twice.length ? `<p class="mk-flag warn">Groups in two rows: ${twice.join(', ')}</p>` : ''}
      ${extra.length && all.length ? `<p class="mk-flag warn">In the load but not groups of this item: ${extra.join(', ')}</p>` : ''}
      ${admin() ? `<label class="mk-loadchk"><input type="checkbox" data-mk-unlock ${data.doc.unlocked ? 'checked' : ''} /> Allow renumbering groups on the Groups page while marks exist (not recommended: marks are saved by group number)</label>` : ''}
      <details class="mk-numbers"><summary>Numbers check: every group with its members (compare with the proposal report)</summary>
        <div class="mk-tablewrap"><table class="mk-table"><thead><tr><th>Group</th><th>TA</th><th>Members</th></tr></thead><tbody>${data.groups.map((g) => `<tr><th scope="row" class="mono">${g.number}</th><td>${esc(taOf(g.number)) || '<span class="faint">—</span>'}</td><td>${g.members.map((m) => `${esc(m.name)} <span class="mono faint">${esc(m.id)}</span>`).join(' · ')}</td></tr>`).join('')}</tbody></table></div>
      </details>`;
  }
  function readLoad() {
    return data.doc.tas.map((t, i) => ({
      name: root.querySelector<HTMLInputElement>(`[data-mk-ta-name="${i}"]`)?.value ?? t.name,
      email: root.querySelector<HTMLSelectElement>(`[data-mk-ta-email="${i}"]`)?.value || null,
      groups: (root.querySelector<HTMLInputElement>(`[data-mk-ta-groups="${i}"]`)?.value ?? t.groups.join(','))
        .split(/[\s,;]+/)
        .map((x) => Number(x.replace(/^g/i, '')))
        .filter((n) => Number.isInteger(n) && n > 0),
    }));
  }

  /* ------------------------------------------------------------------ summary */
  function renderSummary() {
    const total = data.groups.length;
    const done = data.groups.filter((g) => isMarked(g.number));
    const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 } as Record<string, number>;
    for (const g of done) grades[totals(marksOf(g.number)!.scores).grade]++;
    const max = Math.max(1, ...Object.values(grades));
    const tas = data.doc.tas.map((t) => {
      const own = t.groups.filter(isMarked);
      const avg = own.length ? own.reduce((a, g) => a + totals(marksOf(g)!.scores).percent, 0) / own.length : null;
      return `<tr><th scope="row">${esc(t.name)}</th><td class="mono">${own.length} / ${t.groups.length}</td><td class="mono">${avg === null ? '–' : `${fmt(avg)} %`}</td><td><div class="mk-meter"><i style="--w:${t.groups.length ? (own.length / t.groups.length) * 100 : 0}%"></i></div></td></tr>`;
    });
    // consistency: each TA's average per criterion next to the class average; far-off cells are flagged
    const markers = data.doc.tas.filter((t) => t.groups.some((g) => marksOf(g)));
    const consistency = markers.length >= 2
      ? `<h2 class="mk-h2">Marking consistency</h2>
        <p class="small muted">Each TA’s average mark per criterion. Cells at least 15% of the criterion’s marks away from the class average are flagged: worth a second look, not always wrong.</p>
        <div class="mk-tablewrap"><table class="mk-table mk-cons"><thead><tr><th>Criterion</th><th>Class</th>${markers.map((t) => `<th>${esc(t.name)}</th>`).join('')}</tr></thead><tbody>${CRITERIA.map((c) => {
          const cls = average(c.id);
          return `<tr><th scope="row">${esc(c.label)} <span class="mono faint">/ ${c.max}</span></th><td class="mono">${cls ? fmt(cls.avg) : '–'}</td>${markers
            .map((t) => {
              const a = average(c.id, t.groups);
              const off = a && cls && Math.abs(a.avg - cls.avg) >= 0.15 * c.max;
              return `<td class="mono${off ? ' mk-off' : ''}"${off ? ` title="${a!.avg > cls!.avg ? 'Above' : 'Below'} the class average by ${fmt(Math.abs(a!.avg - cls!.avg))}"` : ''}>${a ? fmt(a.avg) : '–'}${off ? (a!.avg > cls!.avg ? ' ▲' : ' ▼') : ''}</td>`;
            })
            .join('')}</tr>`;
        }).join('')}</tbody></table></div>`
      : '';
    $('[data-mk-summary]').innerHTML = `
      <div class="mk-kpis"><div class="mk-kpi"><span>Marked</span><b>${done.length}<small> / ${total}</small></b><div class="mk-meter"><i style="--w:${total ? (done.length / total) * 100 : 0}%"></i></div></div>
      <div class="mk-kpi"><span>Average</span><b>${done.length ? `${fmt(done.reduce((a, g) => a + totals(marksOf(g.number)!.scores).percent, 0) / done.length)}<small> %</small>` : '–'}</b></div></div>
      <div class="mk-grades" role="img" aria-label="Grades: ${Object.entries(grades).map(([g, n]) => `${g} ${n}`).join(', ')}">${Object.entries(grades).map(([g, n]) => `<div class="mk-gbar"><span class="mk-grade" data-g="${g}">${g}</span><i style="--h:${(n / max) * 100}%"></i><b class="mono">${n}</b></div>`).join('')}</div>
      <div class="mk-tablewrap"><table class="mk-table"><thead><tr><th>TA</th><th>Marked</th><th>Average</th><th>Progress</th></tr></thead><tbody>${tas.join('') || '<tr><td colspan="4" class="faint">No marking load yet.</td></tr>'}</tbody></table></div>
      ${consistency}`;
  }

  function render() {
    renderHead();
    renderMarks();
    renderLoad();
    renderSummary();
  }

  /* ------------------------------------------------------------------ events */
  root.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const open = t.closest<HTMLElement>('[data-mk-open]');
    if (open) return openGroup(Number(open.dataset.mkOpen));
    const f = t.closest<HTMLElement>('[data-mk-filter]');
    if (f) {
      filter = f.dataset.mkFilter as typeof filter;
      return renderMarks();
    }
    const tab = t.closest<HTMLElement>('[data-mk-tab]');
    if (tab) {
      root.querySelectorAll<HTMLElement>('[data-mk-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === tab)));
      root.querySelectorAll<HTMLElement>('[data-mk-panel]').forEach((p) => (p.hidden = p.dataset.mkPanel !== tab.dataset.mkTab));
      return;
    }
    const pick = t.closest<HTMLElement>('[data-mk-pick]');
    if (pick) {
      select(pick.dataset.mkPick as CriterionId);
      return panel.querySelector<HTMLElement>('[data-mk-q]:not([disabled]), .mk-step')?.focus();
    }
    const step = t.closest<HTMLElement>('[data-mk-step]');
    if (step) {
      const i = CRITERIA.findIndex((c) => c.id === active) + Number(step.dataset.mkStep);
      if (CRITERIA[i]) select(CRITERIA[i].id);
      (panel.querySelector<HTMLElement>(`[data-mk-step="${step.dataset.mkStep}"]:not([disabled])`) ?? panel.querySelector<HTMLElement>('.mk-step:not([disabled])'))?.focus();
      if (narrow.matches) panel.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (t.closest('[data-mk-use]')) {
      const s = suggest(active, help[active] ?? {});
      if (s !== null) {
        setMark(active, s);
        manual.delete(active);
        updateTotals();
        renderOut();
        saveDraft();
      }
      return;
    }
    if (t.closest('[data-mk-auto]')) return void autoFill();
    if (t.closest('[data-mk-full]')) {
      for (const c of CRITERIA) if (!inputOf(c.id).value.trim()) setMark(c.id, c.max);
      updateTotals();
      renderOut();
      return saveDraft();
    }
    if (t.closest('[data-mk-discard]')) {
      drafts.del(current);
      renderMarks();
      return openGroup(current);
    }
    const aiBtn = t.closest<HTMLElement>('[data-mk-ai], [data-mk-ai-d]');
    if (aiBtn) {
      const n = aiBtn.dataset.mkAi ? Number(aiBtn.dataset.mkAi) : current;
      const on = !callOf(n);
      if (on && !confirm(`Call group ${n} to discuss their project?\n\nOn the Project page these students will see only a request to come and discuss their project with their TA: no marks and no feedback, until you lift the call.`)) return;
      const tell = (text: string, tone: 'ok' | 'err') => {
        say(text, tone);
        if (dlg.open) $('[data-mk-d-msg]').textContent = text;
      };
      try {
        const j = await api({ action: 'call', group: n, on });
        data.doc = j.doc;
        renderHead();
        renderMarks();
        if (dlg.open && current === n) showCall(n);
        tell(on ? `Group ${n} is called to discuss: its students see only the call.` : `Call lifted for group ${n}: its students see their marks and feedback again once marks are published.`, 'ok');
      } catch (error) {
        tell((error as Error).message, 'err');
      }
      return;
    }
    if (t.closest('[data-mk-proj-toggle]')) {
      setProj(!projOn());
      placePanel();
      if (projOn() && current) void project.show(current);
      return;
    }
    if (t.closest('[data-mk-close]')) return dlg.close();
    if (t.closest('[data-mk-save-next]')) return save(true);
    if (t.closest('[data-mk-save]')) return save();
    if (t.closest('[data-mk-import]')) return doImport();
    if (t.closest('[data-mk-cancel]')) {
      preview = null;
      $('[data-mk-preview]').hidden = true;
      return;
    }
    if (t.closest('[data-mk-copy]')) {
      navigator.clipboard?.writeText(CSV_HEADER).then(
        () => say('The CSV header is copied: paste it in the first row of your sheet.', 'ok'),
        () => say('Copy did not work: select the header text and copy it.', 'err'),
      );
      return;
    }
    if (t.closest('[data-mk-publish]')) {
      try {
        const j = await api({ action: 'publish', published: !data.doc.published });
        data.doc = j.doc;
        renderHead();
        say(data.doc.published ? 'Published: students can see their marks.' : 'Hidden: students no longer see marks.', 'ok');
      } catch (error) {
        say((error as Error).message, 'err');
      }
      return;
    }
    if (t.closest('[data-mk-ta-add]')) {
      data.doc.tas = [...readLoad(), { name: 'New TA', email: null, groups: [] }];
      return renderLoad();
    }
    const del = t.closest<HTMLElement>('[data-mk-ta-del]');
    if (del) {
      data.doc.tas = readLoad().filter((_, i) => i !== Number(del.dataset.mkTaDel));
      return renderLoad();
    }
    if (t.closest('[data-mk-ta-save]')) {
      try {
        const j = await api({ action: 'load', tas: readLoad() });
        data.doc = j.doc;
        data.loadSaved = true;
        render();
        say('Marking load saved.', 'ok');
      } catch (error) {
        say((error as Error).message, 'err');
      }
    }
  });
  root.addEventListener('change', async (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-mk-q]')) {
      const kind = t.dataset.kind;
      return answer(t.dataset.mkQ!, kind === 'yes' ? t.checked : kind === 'level' ? t.value : t.value === '' ? undefined : Number(t.value));
    }
    if (t.matches('[data-mk-file]') && t.files?.[0]) {
      await readFile(t.files[0]);
      t.value = '';
      return;
    }
    if (t.matches('[data-mk-src]')) {
      try {
        const j = await api({ action: 'source', fileId: t.value });
        data.doc = j.doc;
        await load();
      } catch (error) {
        say((error as Error).message, 'err');
      }
      return;
    }
    if (t.matches('[data-mk-unlock]')) {
      try {
        const j = await api({ action: 'unlock', unlocked: t.checked });
        data.doc = j.doc;
        say(t.checked ? 'Renumbering is allowed on the Groups page.' : 'Group numbers are locked again.', 'ok');
      } catch (error) {
        say((error as Error).message, 'err');
      }
    }
  });
  root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-mk-q][data-kind="count"]')) return answer(t.dataset.mkQ!, t.value === '' ? undefined : Number(t.value));
    if (t.matches('[data-mk-in]')) {
      const id = t.dataset.mkIn as CriterionId;
      manual.add(id);
      tag(id, null);
      if (id !== active) select(id);
      else renderOut();
    }
    if (t.matches('[data-mk-in], [data-mk-comment]')) {
      updateTotals();
      saveDraft();
    }
    if (t.matches('[data-mk-search]')) {
      query = t.value;
      renderMarks();
    }
  });
  root.addEventListener('focusin', (e) => {
    const id = (e.target as HTMLElement).dataset?.mkIn as CriterionId | undefined;
    if (id && dlg.open) select(id);
  });
  dlg.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && editable(current)) {
      e.preventDefault();
      save(e.shiftKey);
    }
  });
  dlg.addEventListener('close', () => {
    writeDraft();
    renderMarks();
  });
  narrow.addEventListener('change', () => dlg.open && placePanel());
  // drop a file anywhere on the upload box
  const drop = $('.mk-upload');
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.dataset.over = '1';
  });
  drop.addEventListener('dragleave', () => delete drop.dataset.over);
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    delete drop.dataset.over;
    const f = e.dataTransfer?.files?.[0];
    if (f) readFile(f);
  });
  load();
}
