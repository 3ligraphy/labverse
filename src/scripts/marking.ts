/**
 * Admin → Marking (Phase 1) in the browser: the group list, the marking form with the grading assistant, the
 * workbook upload (read here, imported by the API), the marking load and the summary.
 * The API (src/pages/api/admin/marking) checks every permission again; this file only shows what you may do.
 */
import { CRITERIA, MAX_COMMENT, SECTIONS, cleanScore, totals, type CriterionId, type Scores } from '@/lib/marking/rubric';
import { CHECKLIST, RULES } from '@/lib/marking/assistant';
import { canEdit, type MarkingDoc, type Marker } from '@/lib/marking/doc';
import { parseMarkingWorkbook, type ParsedRow } from '@/lib/marking/xlsx-read';

type Group = { number: number; members: { id: string; name: string }[]; idea: string };
type Data = {
  doc: MarkingDoc;
  me: Marker & { row: string | null };
  files: { id: string; title: string }[];
  groups: Group[];
  staff: { name: string; email: string }[];
  changes: { group: number; added: string[]; removed: string[] }[];
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '–' : String(Math.round(n * 100) / 100));
const when = (iso: string) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

export function initMarking(root: HTMLElement) {
  let data: Data;
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
      if (data.me.role === 'ta' && data.me.row) filter = 'mine';
      render();
    } catch (error) {
      say((error as Error).message, 'err');
    }
  }
  const me = () => data.me as Marker;
  const editable = (n: number) => canEdit(me(), data.doc, n);
  const taOf = (n: number) => data.doc.tas.find((t) => t.groups.includes(n))?.name ?? '';
  const marksOf = (n: number) => data.doc.marks[String(n)];
  /** complete: all 9 marks; started: some marks */
  const isMarked = (n: number) => !!marksOf(n) && totals(marksOf(n)!.scores).missing.length === 0;
  const markCount = (n: number) => (marksOf(n) ? CRITERIA.length - totals(marksOf(n)!.scores).missing.length : 0);
  const admin = () => data.me.role === 'admin';

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
    $('[data-mk-pubnote]').innerHTML = data.doc.published
      ? `<b>Published</b>: a student who types their ID on the Project page sees their group’s marks, grade and comments${data.doc.publishedBy ? ` (published by ${esc(data.doc.publishedBy)}, ${esc(when(data.doc.publishedAt))})` : ''}.`
      : 'Not published: students see nothing yet.';
    $('[data-mk-role]').textContent =
      data.me.role === 'admin' ? 'You are an admin: you can mark every group and change the marking load.' : data.me.row ? `You mark the groups of ${data.me.row}. Other groups are read-only for you.` : 'Your account is not linked to a row of the marking load yet: ask an admin to link it (Marking load tab). Until then every group is read-only.';
  }

  /* ------------------------------------------------------------------ marks tab */
  function visibleGroups() {
    const q = query.toLowerCase();
    return data.groups.filter((g) => {
      if (filter === 'mine' && !editable(g.number)) return false;
      if (filter === 'todo' && isMarked(g.number)) return false;
      if (filter === 'done' && !isMarked(g.number)) return false;
      if (!q) return true;
      return `group ${g.number} ${taOf(g.number)} ${g.idea} ${g.members.map((m) => `${m.name} ${m.id}`).join(' ')}`.toLowerCase().includes(q);
    });
  }
  function renderMarks() {
    const mine = data.groups.filter((g) => editable(g.number));
    const counts = { mine: mine.length, all: data.groups.length, todo: data.groups.filter((g) => !isMarked(g.number)).length, done: data.groups.filter((g) => isMarked(g.number)).length };
    root.querySelectorAll<HTMLButtonElement>('[data-mk-filter]').forEach((b) => {
      const f = b.dataset.mkFilter as typeof filter;
      b.setAttribute('aria-pressed', String(f === filter));
      b.querySelector('span')!.textContent = String(counts[f]);
      if (f === 'mine') b.hidden = !mine.length;
    });
    const changed = new Map(data.changes.map((c) => [c.group, c]));
    const rows = visibleGroups().map((g) => {
      const m = marksOf(g.number);
      const t = m ? totals(m.scores) : null;
      const done = isMarked(g.number);
      const status = changed.has(g.number) ? '<span class="mk-flag warn">Members changed since marked</span>' : done ? `<span class="mk-flag ok">Marked${m!.by ? ` by ${esc(m!.by)}` : ''}</span>` : markCount(g.number) ? `<span class="mk-flag">Started · ${markCount(g.number)} / ${CRITERIA.length}</span>` : '<span class="mk-flag">Not marked</span>';
      return `<tr>
        <th scope="row" class="mono">${g.number}</th>
        <td>${esc(taOf(g.number)) || '<span class="faint">—</span>'}</td>
        <td class="mk-members">${g.members.map((x) => esc(x.name)).join(', ')}</td>
        <td class="mk-idea">${esc(g.idea) || '<span class="faint">—</span>'}</td>
        <td class="mono">${t && t.grade ? `${fmt(t.total)}` : '–'}</td>
        <td>${t && t.grade ? `<span class="mk-grade" data-g="${t.grade}">${t.grade}</span>` : ''}</td>
        <td>${status}</td>
        <td><button type="button" class="btn btn-sm ${editable(g.number) ? 'btn-primary' : 'btn-ghost'}" data-mk-open="${g.number}">${editable(g.number) ? (m ? 'Edit' : 'Mark') : 'View'}</button></td>
      </tr>`;
    });
    $('[data-mk-rows]').innerHTML = rows.join('') || `<tr><td colspan="8" class="faint">No groups here.</td></tr>`;
  }

  /* ------------------------------------------------------------------ the marking form + assistant */
  const dlg = $<HTMLDialogElement>('[data-mk-dlg]');
  let current = 0;
  let ticked = new Set<string>();
  const averages = () => {
    const out: Partial<Record<CriterionId, number>> = {};
    for (const c of CRITERIA) {
      const vals = Object.values(data.doc.marks).map((m) => m.scores[c.id]).filter((v): v is number => typeof v === 'number');
      if (vals.length) out[c.id] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
    }
    return out;
  };
  function openGroup(n: number) {
    current = n;
    ticked = new Set();
    const g = data.groups.find((x) => x.number === n)!;
    const m = marksOf(n);
    const can = editable(n);
    const avg = averages();
    const change = data.changes.find((c) => c.group === n);
    $('[data-mk-d-title]').textContent = `Group ${n}${g.idea ? ` · ${g.idea}` : ''}`;
    $('[data-mk-d-meta]').innerHTML = `${esc(taOf(n)) ? `TA: <b>${esc(taOf(n))}</b> · ` : ''}${g.members.map((x) => `${esc(x.name)} <span class="mono faint">${esc(x.id)}</span>`).join(' · ')}${change ? `<br><span class="mk-flag warn">Members changed since it was marked: +${change.added.length} / −${change.removed.length}. Check the group before you save.</span>` : ''}${m?.at ? `<br><span class="faint">Last saved ${esc(when(m.at))}${m.by ? ` by ${esc(m.by)}` : ''}</span>` : ''}`;
    $('[data-mk-form]').innerHTML = SECTIONS.map((s) => `
      <fieldset class="mk-sec">
        <legend><span>${esc(s.title)}</span><span class="mono" data-mk-sub="${s.id}"></span></legend>
        ${CRITERIA.filter((c) => c.section === s.id).map((c) => `
          <label class="mk-crit">
            <span class="mk-crit-l">${esc(c.label)}<small class="faint">${avg[c.id] !== undefined ? `class avg ${fmt(avg[c.id])}` : ''}</small></span>
            <span class="mk-crit-in"><input class="input mono" type="text" inputmode="decimal" autocomplete="off" data-mk-in="${c.id}" value="${m?.scores[c.id] ?? ''}" ${can ? '' : 'disabled'} aria-label="${esc(c.label)}, out of ${c.max}" /><span class="mono faint">/ ${c.max}</span></span>
          </label>`).join('')}
      </fieldset>`).join('');
    const comment = $<HTMLTextAreaElement>('[data-mk-comment]');
    comment.value = m?.comment ?? '';
    comment.disabled = !can;
    comment.maxLength = MAX_COMMENT;
    $<HTMLButtonElement>('[data-mk-save]').hidden = !can;
    $('[data-mk-ro]').hidden = can;
    $('[data-mk-check]').innerHTML = SECTIONS.map((s) => `
      <div class="mk-chk-sec"><p class="mk-chk-h">${esc(s.title)}</p>
        ${CHECKLIST.filter((i) => CRITERIA.find((c) => c.id === i.criterion)!.section === s.id).map((i) => `
          <label class="mk-chk"><input type="checkbox" data-mk-tick="${i.id}" ${can ? '' : 'disabled'} /><span>${esc(i.label)}</span><span class="mono faint">${i.deduction ? `−${i.deduction}` : 'note'}</span></label>`).join('')}
      </div>`).join('');
    $('[data-mk-rule]').innerHTML = '<span class="faint">Click a mark to see its rule from the brief.</span>';
    $('[data-mk-d-msg]').textContent = '';
    updateTotals();
    if (!dlg.open) dlg.showModal();
    (root.querySelector<HTMLInputElement>('[data-mk-in]:not([disabled])') ?? $('[data-mk-close]')).focus();
  }
  function formScores(): Scores {
    const s: Scores = {};
    root.querySelectorAll<HTMLInputElement>('[data-mk-in]').forEach((i) => {
      const c = CRITERIA.find((x) => x.id === i.dataset.mkIn)!;
      const v = cleanScore(i.value, c.max);
      if (v !== null) s[c.id] = v;
    });
    return s;
  }
  function updateTotals() {
    const t = totals(formScores());
    for (const s of SECTIONS) $(`[data-mk-sub="${s.id}"]`).textContent = `${fmt(t.sections[s.id])} / ${s.max}`;
    $('[data-mk-total]').innerHTML = t.grade ? `<b>${fmt(t.total)}</b> / 30 · ${fmt(t.percent)} / 100 · grade <span class="mk-grade" data-g="${t.grade}">${t.grade}</span>` : 'No marks yet';
    const warn: string[] = [];
    if (t.missing.length && t.missing.length < CRITERIA.length) warn.push(`${t.missing.length} mark${t.missing.length === 1 ? '' : 's'} still empty: ${t.missing.map((id) => CRITERIA.find((c) => c.id === id)!.label).join(', ')}.`);
    root.querySelectorAll<HTMLInputElement>('[data-mk-in]').forEach((i) => {
      const c = CRITERIA.find((x) => x.id === i.dataset.mkIn)!;
      const raw = i.value.trim();
      const v = cleanScore(raw, c.max);
      const bad = raw !== '' && (v === null || Number(raw.replace(',', '.')) !== v);
      i.setAttribute('aria-invalid', String(bad));
      if (bad) warn.push(`${c.label}: “${raw}” is saved as ${v === null ? 'empty' : v} (0 to ${c.max}).`);
    });
    if (!$<HTMLTextAreaElement>('[data-mk-comment]').value.trim() && !t.missing.length) warn.push('The comment is empty: students learn most from it.');
    $('[data-mk-warn]').innerHTML = warn.map((w) => `<li>${esc(w)}</li>`).join('');
    $('[data-mk-count]').textContent = `${$<HTMLTextAreaElement>('[data-mk-comment]').value.length} / ${MAX_COMMENT}`;
  }
  function tick(id: string, on: boolean) {
    const item = CHECKLIST.find((i) => i.id === id)!;
    const c = CRITERIA.find((x) => x.id === item.criterion)!;
    const input = root.querySelector<HTMLInputElement>(`[data-mk-in="${c.id}"]`)!;
    const now = cleanScore(input.value, c.max);
    if (item.deduction) {
      const base = now ?? c.max;
      const next = on ? Math.max(0, base - item.deduction) : Math.min(c.max, base + item.deduction);
      input.value = String(Math.round(next * 100) / 100);
    }
    const box = $<HTMLTextAreaElement>('[data-mk-comment]');
    const line = `• ${item.sentence}`;
    if (on && !box.value.includes(item.sentence)) box.value = `${box.value.trim() ? `${box.value.trim()}\n` : ''}${line}`;
    if (!on) box.value = box.value.split('\n').filter((l) => l.trim() !== line).join('\n');
    on ? ticked.add(id) : ticked.delete(id);
    updateTotals();
  }
  async function save() {
    const btn = $<HTMLButtonElement>('[data-mk-save]');
    btn.disabled = true;
    try {
      const j = await api({ action: 'marks', group: current, scores: formScores(), comment: $<HTMLTextAreaElement>('[data-mk-comment]').value });
      data.doc = j.doc;
      data.changes = data.changes.filter((c) => c.group !== current);
      $('[data-mk-d-msg]').textContent = `Saved ${new Date().toLocaleTimeString([], { timeStyle: 'short' })}.`;
      renderMarks();
      renderSummary();
    } catch (error) {
      $('[data-mk-d-msg]').textContent = (error as Error).message;
    } finally {
      btn.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ upload */
  function showPreview(rows: ParsedRow[], warnings: string[]) {
    preview = rows;
    const box = $('[data-mk-preview]');
    const known = new Set(data.groups.map((g) => g.number));
    const marked = rows.filter((r) => Object.keys(r.scores).length);
    const lines = marked.map((r) => {
      const t = totals(r.scores);
      const why = !known.has(r.group) ? 'not a group of this item' : !editable(r.group) ? 'not one of your groups: skipped' : marksOf(r.group) ? 'replaces the saved marks' : 'new';
      return `<tr><th scope="row" class="mono">${r.group}</th><td>${esc(r.ta)}</td><td class="mono">${fmt(t.total)} / 30</td><td><span class="mk-grade" data-g="${t.grade}">${t.grade}</span></td><td class="faint">${esc(r.sheet)}</td><td>${esc(why)}</td></tr>`;
    });
    const importable = marked.filter((r) => known.has(r.group) && editable(r.group)).length;
    box.hidden = false;
    box.innerHTML = `
      <p><b>${marked.length}</b> group${marked.length === 1 ? '' : 's'} with marks in the file · <b>${importable}</b> you can import${rows.length > marked.length ? ` · ${rows.length - marked.length} without marks yet` : ''}.</p>
      ${warnings.map((w) => `<p class="mk-flag warn">${esc(w)}</p>`).join('')}
      ${lines.length ? `<div class="mk-tablewrap"><table class="mk-table"><thead><tr><th>Group</th><th>TA in the file</th><th>Total</th><th>Grade</th><th>Sheet</th><th>What happens</th></tr></thead><tbody>${lines.join('')}</tbody></table></div>` : ''}
      ${admin() && rows.some((r) => r.ta) ? '<label class="mk-loadchk"><input type="checkbox" data-mk-useload /> Also set the marking load from this file’s “Assigned TA” column</label>' : ''}
      <div class="mk-actions"><button type="button" class="btn btn-primary btn-sm" data-mk-import ${importable ? '' : 'disabled'}>Import ${importable} group${importable === 1 ? '' : 's'}</button><button type="button" class="btn btn-ghost btn-sm" data-mk-cancel>Cancel</button></div>`;
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
      const j = await api({ action: 'import', rows: preview.filter((r) => Object.keys(r.scores).length || r.comment).map((r) => ({ group: r.group, ta: r.ta, scores: r.scores, comment: r.comment })) });
      data.doc = j.doc;
      const skipped = (j.skipped as { group: number; reason: string }[]).filter((s) => preview!.some((r) => r.group === s.group && Object.keys(r.scores).length));
      say(`Imported ${j.imported.length} group${j.imported.length === 1 ? '' : 's'}${j.imported.length ? ` (${j.imported.join(', ')})` : ''}.${skipped.length ? ` Skipped ${skipped.length}: ${skipped.map((s) => `${s.group}`).join(', ')} (not your groups or no marks).` : ''}`, 'ok');
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
    const count = new Map<number, number>();
    for (const t of data.doc.tas) for (const g of t.groups) count.set(g, (count.get(g) ?? 0) + 1);
    const none = all.filter((g) => !count.get(g));
    const twice = [...count].filter(([, c]) => c > 1).map(([g]) => g);
    const rows = data.doc.tas.map((t, i) => {
      const marked = t.groups.filter(isMarked).length;
      return `<tr>
        <td>${admin() ? `<input class="input" data-mk-ta-name="${i}" value="${esc(t.name)}" aria-label="TA name" />` : esc(t.name)}</td>
        <td>${admin() ? `<select class="input mk-select" data-mk-ta-email="${i}" aria-label="Account of ${esc(t.name)}"><option value="">— not linked —</option>${data.staff.map((s) => `<option value="${esc(s.email)}" ${s.email === t.email ? 'selected' : ''}>${esc(s.name)} · ${esc(s.email)}</option>`).join('')}</select>` : t.email ? esc(data.staff.find((s) => s.email === t.email)?.name ?? t.email) : '<span class="faint">not linked</span>'}</td>
        <td>${admin() ? `<input class="input mono" data-mk-ta-groups="${i}" value="${esc(t.groups.join(', '))}" aria-label="Groups of ${esc(t.name)}" />` : `<span class="mono">${esc(t.groups.join(', '))}</span>`}</td>
        <td class="mono">${t.groups.length}</td>
        <td><div class="mk-meter" title="${marked} of ${t.groups.length} marked"><i style="--w:${t.groups.length ? (marked / t.groups.length) * 100 : 0}%"></i></div><span class="mono faint">${marked} / ${t.groups.length}</span></td>
        ${admin() ? `<td><button type="button" class="btn btn-ghost btn-sm" data-mk-ta-del="${i}" aria-label="Remove ${esc(t.name)}">Remove</button></td>` : ''}
      </tr>`;
    });
    $('[data-mk-load]').innerHTML = `
      <div class="mk-tablewrap"><table class="mk-table">
        <thead><tr><th>TA</th><th>Account</th><th>Groups</th><th>Count</th><th>Marked</th>${admin() ? '<th></th>' : ''}</tr></thead>
        <tbody>${rows.join('') || `<tr><td colspan="6" class="faint">No marking load yet. ${admin() ? 'Upload the marking sheet on the Marks tab and tick “Also set the marking load”, or add the TAs here.' : 'An admin sets it.'}</td></tr>`}</tbody>
      </table></div>
      ${admin() ? '<div class="mk-actions"><button type="button" class="btn btn-ghost btn-sm" data-mk-ta-add>Add a TA</button><button type="button" class="btn btn-primary btn-sm" data-mk-ta-save>Save the marking load</button></div>' : ''}
      ${none.length ? `<p class="mk-flag warn">Groups with no TA: ${none.join(', ')}</p>` : data.doc.tas.length ? '<p class="mk-flag ok">Every group has a TA.</p>' : ''}
      ${twice.length ? `<p class="mk-flag warn">Groups in two rows: ${twice.join(', ')}</p>` : ''}
      ${admin() ? `<label class="mk-loadchk"><input type="checkbox" data-mk-unlock ${data.doc.unlocked ? 'checked' : ''} /> Allow renumbering groups on the Groups page while marks exist (not recommended: marks are saved by group number)</label>` : ''}
      <details class="mk-numbers"><summary>Numbers check: every group with its members (compare with the proposal report)</summary>
        <div class="mk-tablewrap"><table class="mk-table"><thead><tr><th>Group</th><th>Members</th></tr></thead><tbody>${data.groups.map((g) => `<tr><th scope="row" class="mono">${g.number}</th><td>${g.members.map((m) => `${esc(m.name)} <span class="mono faint">${esc(m.id)}</span>`).join(' · ')}</td></tr>`).join('')}</tbody></table></div>
      </details>`;
  }
  function readLoad() {
    return data.doc.tas.map((t, i) => ({
      name: root.querySelector<HTMLInputElement>(`[data-mk-ta-name="${i}"]`)?.value ?? t.name,
      email: root.querySelector<HTMLSelectElement>(`[data-mk-ta-email="${i}"]`)?.value || null,
      groups: (root.querySelector<HTMLInputElement>(`[data-mk-ta-groups="${i}"]`)?.value ?? t.groups.join(',')).split(/[\s,;]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0),
    }));
  }

  /* ------------------------------------------------------------------ summary */
  function renderSummary() {
    const total = data.groups.length;
    const marked = data.groups.filter((g) => isMarked(g.number)).length;
    const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 } as Record<string, number>;
    for (const g of data.groups) if (isMarked(g.number)) grades[totals(marksOf(g.number)!.scores).grade]++;
    const max = Math.max(1, ...Object.values(grades));
    const tas = data.doc.tas.map((t) => {
      const done = t.groups.filter(isMarked);
      const avg = done.length ? done.reduce((a, g) => a + totals(marksOf(g)!.scores).percent, 0) / done.length : null;
      return `<tr><th scope="row">${esc(t.name)}</th><td class="mono">${done.length} / ${t.groups.length}</td><td class="mono">${avg === null ? '–' : `${fmt(avg)} %`}</td><td><div class="mk-meter"><i style="--w:${t.groups.length ? (done.length / t.groups.length) * 100 : 0}%"></i></div></td></tr>`;
    });
    $('[data-mk-summary]').innerHTML = `
      <div class="mk-kpis"><div class="mk-kpi"><span>Marked</span><b>${marked}<small> / ${total}</small></b><div class="mk-meter"><i style="--w:${total ? (marked / total) * 100 : 0}%"></i></div></div>
      <div class="mk-kpi"><span>Average</span><b>${(() => { const done = data.groups.filter((g) => isMarked(g.number)); return done.length ? `${fmt(done.reduce((a, g) => a + totals(marksOf(g.number)!.scores).percent, 0) / done.length)}<small> %</small>` : '–'; })()}</b></div></div>
      <div class="mk-grades" role="img" aria-label="Grades: ${Object.entries(grades).map(([g, n]) => `${g} ${n}`).join(', ')}">${Object.entries(grades).map(([g, n]) => `<div class="mk-gbar"><span class="mk-grade" data-g="${g}">${g}</span><i style="--h:${(n / max) * 100}%"></i><b class="mono">${n}</b></div>`).join('')}</div>
      <div class="mk-tablewrap"><table class="mk-table"><thead><tr><th>TA</th><th>Marked</th><th>Average</th><th>Progress</th></tr></thead><tbody>${tas.join('') || '<tr><td colspan="4" class="faint">No marking load yet.</td></tr>'}</tbody></table></div>`;
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
    if (t.closest('[data-mk-close]')) return dlg.close();
    if (t.closest('[data-mk-save]')) return save();
    if (t.closest('[data-mk-import]')) return doImport();
    if (t.closest('[data-mk-cancel]')) {
      preview = null;
      $('[data-mk-preview]').hidden = true;
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
        render();
        say('Marking load saved.', 'ok');
      } catch (error) {
        say((error as Error).message, 'err');
      }
    }
  });
  root.addEventListener('change', async (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-mk-tick]')) return tick(t.dataset.mkTick!, t.checked);
    if (t.matches('[data-mk-file]') && t.files?.[0]) {
      try {
        const out = parseMarkingWorkbook(new Uint8Array(await t.files[0].arrayBuffer()));
        showPreview(out.rows, out.warnings);
      } catch (error) {
        say((error as Error).message, 'err');
      }
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
    const t = e.target as HTMLElement;
    if (t.matches('[data-mk-in], [data-mk-comment]')) updateTotals();
    if (t.matches('[data-mk-in]')) showRule(t.dataset.mkIn as CriterionId);
    if (t.matches('[data-mk-search]')) {
      query = (t as HTMLInputElement).value;
      renderMarks();
    }
  });
  function showRule(id: CriterionId) {
    const c = CRITERIA.find((x) => x.id === id)!;
    $('[data-mk-rule]').innerHTML = `<b>${esc(c.label)}</b> (out of ${c.max}): ${esc(RULES[id])}`;
  }
  root.addEventListener('focusin', (e) => {
    const id = (e.target as HTMLElement).dataset?.mkIn as CriterionId | undefined;
    if (id) showRule(id);
  });
  root.addEventListener('pointerdown', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-mk-in]')?.dataset.mkIn as CriterionId | undefined;
    if (id) showRule(id);
  });
  load();
}
