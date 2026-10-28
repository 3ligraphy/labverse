/**
 * The session-aware Start Lab card. Guests type a name (letters) and a student ID (digits); the group is optional.
 * Nothing else is checked: any device, shared lab PCs, the same ID again. Signed-in students never see the form:
 * they join the open session by themselves.
 */
import { clearStudent, deviceId, getStudent, setStudent } from './store.ts';
import { cleanName, cleanStudentId, looseGroup, nameError, studentIdError } from '../../lib/identity.ts';
import { clearProgressIdentity, getIdentity, setProgressIdentity } from '@/scripts/progress';
import { getMe } from '@/scripts/me';

type PublicSession = { id: string; open: boolean; ta_name?: string; time_slot?: string };
type PublicSessionResponse = PublicSession & { sessions?: PublicSession[]; practice?: boolean };

/** each student's last group, per student ID (a shared lab PC never hands one student's group to the next) */
const groupKey = (id: string) => `lab:group:${id}`;
const savedGroup = (id: string) => { try { return localStorage.getItem(groupKey(id)) ?? ''; } catch { return ''; } };
const rememberGroup = (id: string, g: string) => { try { localStorage.setItem(groupKey(id), g); } catch { /* storage off */ } };

const GATED = '[data-exercise],[data-playground],[data-repo-submit],[data-checkin],[data-task-check]';
const PASS_KEYS = /^(Tab|Escape|Shift|Control|Alt|Meta|CapsLock|Arrow\w+|Home|End|PageUp|PageDown|F\d{1,2})$/;

export function mountStart(lab: string) {
  const root = document.querySelector<HTMLElement>('[data-lab-start]');
  if (!root || root.dataset.wired) return;
  root.dataset.wired = '1';
  const form = root.querySelector<HTMLFormElement>('form')!;
  const formBox = root.querySelector<HTMLElement>('[data-ls-form]')!;
  const signed = root.querySelector<HTMLElement>('[data-ls-signed]')!;
  const status = root.querySelector<HTMLElement>('[data-ls-status]')!;
  const err = root.querySelector<HTMLElement>('[data-ls-error]')!;
  const nameIn = form.querySelector<HTMLInputElement>('[name="name"]')!;
  const idIn = form.querySelector<HTMLInputElement>('[name="studentId"]')!;
  const groupIn = form.querySelector<HTMLInputElement>('[name="group"]')!;
  const sessionField = form.querySelector<HTMLElement>('[data-ls-session]')!;
  const sessionIn = form.querySelector<HTMLSelectElement>('[name="sessionId"]')!;
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  let session: PublicSession | null = null;
  let sessions: PublicSession[] = [];
  let practice = false; // the admin's "open practice" toggle: solve without a session, nothing recorded
  let staff = false; // TAs, doctors and admins: try every exercise any time, nothing recorded
  /** a signed-in student whose account identity is valid: joins the open session by itself */
  let account: { name: string; id: string } | null = null;
  const autoTried = new Set<string>();
  const labRoot = root.closest<HTMLElement>('[data-lab]');

  /** Explains a blocked control right under it (role=status), instead of a click that silently does nothing. */
  let note: HTMLElement | null = null;
  let noteAt = 0;
  const explain = (target: HTMLElement) => {
    const access = labRoot?.dataset.sessionAccess;
    // a task's "Done" tick is a visually hidden checkbox: explain under the task header instead
    const block = target.closest<HTMLElement>('.task-head') ?? target.closest<HTMLElement>(GATED) ?? target.closest<HTMLElement>('section, article, .card') ?? target;
    const text = access === 'staff'
      ? 'Staff preview: hand-ins and check-in are for students in a live session. Everything else runs, and nothing is recorded.'
      : access === 'practice'
      ? 'Hand-ins and check-in need a live lab session. Exercises and demos work now in practice mode.'
      : sessions.length
        ? (account ? 'Choose your time slot in Start lab and press Start. Then you can edit, run and check.' : 'Join the session first: enter your name and student ID in Start lab. Then you can edit, run and check.')
        : 'This opens when your TA starts the lab session. You can read everything until then.';
    if (note && note.previousElementSibling === block && note.dataset.text === text && Date.now() - noteAt < 4000) return;
    noteAt = Date.now();
    if (!note) {
      note = document.createElement('div');
      note.className = 'lab-gate-note';
      note.dataset.gateNote = '';
      note.setAttribute('role', 'status');
    }
    note.replaceChildren();
    block.after(note);
    note.dataset.text = text;
    // filled after insertion so screen readers announce it
    setTimeout(() => {
      if (!note) return;
      const p = document.createElement('p');
      p.textContent = text;
      note.replaceChildren(p);
      if (access !== 'practice' && access !== 'staff' && sessions.length) {
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'btn btn-ghost btn-sm';
        go.textContent = 'Go to Start lab ↑';
        go.addEventListener('click', () => {
          root.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
          (formBox.hidden ? root : nameIn.readOnly ? groupIn : nameIn).focus({ preventScroll: true });
        });
        note.append(go);
      }
    }, 60);
  };

  if (labRoot && !labRoot.dataset.sessionGuard) {
    labRoot.dataset.sessionGuard = '1';
    const guard = (event: Event) => {
      if (labRoot.dataset.sessionAccess === 'active') return;
      const target = event.target as HTMLElement | null;
      // the app walkthrough and the explanation visuals ([data-free]) record nothing, so they are always usable
      if (!target || target.closest('[data-lab-start]') || target.closest('[data-gate-note]') || target.closest('a') || target.closest('[data-walkthrough],[data-free]')) return;
      // Practice and staff preview: exercises and demos work, but attendance and submissions still need a session.
      if (/^(practice|staff)$/.test(labRoot.dataset.sessionAccess ?? '') && !target.closest('[data-repo-submit],[data-checkin]')) return;
      // moving focus, scrolling and copying stay available, so keyboard users are never trapped
      if (event instanceof KeyboardEvent && (PASS_KEYS.test(event.key) || ((event.ctrlKey || event.metaKey) && /^[ac]$/i.test(event.key)))) return;
      // only what needs a session is held back: exercises, demos, editors, hand-in, check-in and Done ticks.
      // Copy buttons, tabs and explanation visuals elsewhere on the page always work.
      if (target.closest('.cm-editor,[data-exercise],[data-playground],[data-demo],[data-repo-submit],[data-checkin],.task-done,[data-task-check]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type !== 'change' && event.type !== 'submit') explain(target);
      }
    };
    for (const event of ['click', 'beforeinput', 'keydown', 'change', 'submit']) labRoot.addEventListener(event, guard, true);
  }

  /** aria-disabled on the controls the guard blocks, so assistive tech says "unavailable" before the click */
  const markGated = () => {
    if (!labRoot) return;
    const access = labRoot.dataset.sessionAccess;
    const open = access === 'practice' || access === 'staff';
    const scope = access === 'active' ? '' : open ? '[data-repo-submit],[data-checkin]' : GATED;
    labRoot.querySelectorAll('[data-gate-off]').forEach((el) => { el.removeAttribute('data-gate-off'); el.removeAttribute('aria-disabled'); });
    if (scope) labRoot.querySelectorAll<HTMLElement>(`:is(${scope}) :is(button, input, select, textarea), [data-task-check]:is(button, input)`).forEach((el) => {
      if (open && el.matches('[data-task-check]')) return;
      if (el.closest('[data-gate-note]') || el.hasAttribute('aria-disabled')) return;
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('data-gate-off', '');
    });
    if (access === 'active') note?.remove();
  };

  const show = () => {
    const student = getStudent();
    const current = Boolean(student && session?.open && student.sessionId === session.id);
    form.hidden = sessions.length === 0;
    if (labRoot) labRoot.dataset.sessionAccess = current ? 'active' : staff ? 'staff' : practice ? 'practice' : 'readonly';
    formBox.hidden = current;
    signed.hidden = !current;
    root.classList.toggle('is-signed', current);
    submit.disabled = !session?.open;
    markGated();
    if (current && student) {
      signed.querySelector('[data-ls-name]')!.textContent = student.name;
      signed.querySelector('[data-ls-id]')!.textContent = student.id;
      signed.querySelector('[data-ls-group]')!.textContent = student.group;
      const progress = getIdentity();
      const sharedDeviceId = deviceId();
      if (!progress || progress.sessionId !== student.sessionId || progress.deviceKey !== sharedDeviceId) {
        setProgressIdentity(student.name, student.id, student.group, student.sessionId, sharedDeviceId);
      }
    }
  };

  const refreshSession = async () => {
    try {
      const response = await fetch(`/api/progress/session?lab=${encodeURIComponent(lab)}`, { cache: 'no-store' });
      const data = (await response.json()) as PublicSessionResponse;
      sessions = Array.isArray(data.sessions) ? data.sessions.filter((item) => item.open) : data.open ? [data] : [];
      practice = data.practice === true;
      const student = getStudent();
      const previousId = sessionIn.value;
      sessionIn.replaceChildren(...sessions.map((item) => new Option(`${item.time_slot ?? 'Current time slot'} — ${item.ta_name ?? 'TA'}`, item.id)));
      const preferredId = student && sessions.some((item) => item.id === student.sessionId)
        ? student.sessionId
        : sessions.some((item) => item.id === previousId) ? previousId : sessions[0]?.id ?? '';
      sessionIn.value = preferredId;
      session = sessions.find((item) => item.id === preferredId) ?? null;
      sessionField.hidden = sessions.length < 2;
      status.textContent = staff && !getStudent()
        ? 'Staff preview: you can edit, run and check every exercise and demo now, without starting a session. Nothing you do here is recorded.'
        : sessions.length > 1
        ? `${sessions.length} sessions are running. Choose your time slot and TA, then enter your details.`
        : session
          ? `Session started by ${session.ta_name ?? 'your TA'} · ${session.time_slot ?? 'current time slot'}. Enter your details to begin.`
        : practice
          ? 'Practice mode is on: you can edit and check every exercise now. Your progress is saved in this browser only and is not sent to your TA.'
        : 'Waiting for your TA to start this lab session. You can read the content in the meantime.';
    } catch {
      session = null;
      sessions = [];
      practice = false;
      status.textContent = 'Could not check the session status. You can still read the lab content.';
    }
    show();
    void autoJoin();
  };

  /** Signed-in students: join the one open session automatically (once per session), no form needed. */
  const autoJoin = async () => {
    if (!account || !session?.open || sessions.length !== 1 || autoTried.has(session.id)) return;
    const student = getStudent();
    // already in as this account; a classmate's guest identity left on a shared PC is replaced
    if (student && student.sessionId === session.id && student.id === account.id) return;
    autoTried.add(session.id);
    status.textContent = `Joining ${session.ta_name ? `${session.ta_name}’s` : 'the'} session as ${account.name}…`;
    const problem = await join(account.name, account.id, looseGroup(groupIn.value), session.id);
    if (problem) {
      err.textContent = problem;
      autoTried.delete(session.id); // try again on the next status check
    }
  };

  sessionIn.addEventListener('change', () => {
    session = sessions.find((item) => item.id === sessionIn.value) ?? null;
    err.textContent = '';
    show();
  });

  /** Joins the open session as this student. Returns an error sentence, or null when it worked. */
  const join = async (name: string, id: string, group: string, sessionId: string): Promise<string | null> => {
    try {
      const sharedDeviceId = deviceId();
      const response = await fetch('/api/lab/progress', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lab, name, studentId: id, deviceId: sharedDeviceId, group, sessionId, event: 'start' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return data.message ?? data.error ?? 'Could not start the lab. Try again.';
      // Identity is persisted only after verification
      setStudent({ name, id, group: group || '—', sessionId });
      setProgressIdentity(name, id, group || '—', sessionId, sharedDeviceId);
      if (group) rememberGroup(id, group);
      show();
      return null;
    } catch {
      return 'Could not reach the server. Check the connection and try again.';
    }
  };

  // Live hints while typing, so a name in the ID box (or an ID in the name box) is caught at once.
  const hint = (message: string | null, field: HTMLInputElement) => {
    field.setAttribute('aria-invalid', String(Boolean(message)));
    err.textContent = message ?? '';
  };
  idIn.addEventListener('input', () => {
    const id = cleanStudentId(idIn.value);
    hint(id && /[\p{L}]/u.test(id) ? studentIdError(id) : null, idIn);
  });
  idIn.addEventListener('blur', () => { const id = cleanStudentId(idIn.value); if (id) hint(studentIdError(id), idIn); });
  nameIn.addEventListener('input', () => hint(/\d/.test(nameIn.value) ? nameError(cleanName(nameIn.value)) : null, nameIn));
  groupIn.addEventListener('blur', () => { groupIn.value = looseGroup(groupIn.value); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = cleanName(nameIn.value);
    const id = cleanStudentId(idIn.value);
    const group = looseGroup(groupIn.value);
    // the only checks: a name made of letters, and an ID made of digits
    const badName = nameError(name);
    if (badName) { hint(badName, nameIn); return nameIn.focus(); }
    const badId = studentIdError(id);
    if (badId) { hint(badId, idIn); return idIn.focus(); }
    groupIn.value = group;
    if (!session?.open) {
      err.textContent = 'Your TA has not started this session yet. You can read the lab content for now.';
      return;
    }
    err.textContent = 'Checking…';
    submit.disabled = true;
    const problem = await join(name, id, group, session.id);
    err.textContent = problem ?? '';
    submit.disabled = !session?.open;
  });

  signed.querySelector('[data-ls-change]')?.addEventListener('click', () => {
    const student = getStudent();
    clearStudent();
    clearProgressIdentity();
    if (student) {
      nameIn.value = student.name;
      idIn.value = student.id;
      groupIn.value = student.group;
    }
    show();
    nameIn.focus();
  });

  // Signed-in students: name and ID come from their account (locked); signing in is optional.
  void (async () => {
    const me = await getMe<{ user: { name: string; role: string; studentId: string | null } | null }>();
    const u = me?.user;
    if (u && u.role !== 'student') {
      // staff try the lab without joining a session; joining one stays possible (e.g. to test a hand-in)
      staff = true;
      await refreshSession();
      return;
    }
    if (!u || u.role !== 'student' || !u.studentId) return;
    nameIn.value = u.name;
    idIn.value = u.studentId;
    nameIn.readOnly = idIn.readOnly = true;
    nameIn.title = idIn.title = 'From your account';
    groupIn.value = savedGroup(cleanStudentId(u.studentId));
    const note = document.createElement('p');
    note.className = 'ls-acct';
    note.textContent = `Signed in as ${u.name}: nothing to type. You join the lab session by yourself when your TA starts it, and your progress is saved.`;
    form.prepend(note);
    // a valid account identity joins the open session by itself (no form to fill)
    if (!nameError(cleanName(u.name)) && !studentIdError(cleanStudentId(u.studentId))) {
      account = { name: cleanName(u.name), id: cleanStudentId(u.studentId) };
      await refreshSession();
    }
  })();

  void refreshSession();
  const timer = window.setInterval(() => {
    if (!root.isConnected) return clearInterval(timer);
    if (document.visibilityState === 'visible') void refreshSession();
  }, 15_000);
}
