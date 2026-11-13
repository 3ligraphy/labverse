/**
 * The session-aware Start Lab card. Guests type a name (letters) and a student ID (digits); the group is optional.
 * Nothing else is checked: any device, shared lab PCs, the same ID again. Signed-in students never see the form:
 * they join the open session by themselves.
 */
import { clearStudent, deviceId, getStudent, setStudent } from './store.ts';
import { cleanName, cleanStudentId, looseGroup, nameError, studentIdError } from '../../lib/identity.ts';
import { clearProgressIdentity, getIdentity, setProgressIdentity } from '@/scripts/progress';
import { getMe } from '@/scripts/me';
import { ALWAYS_OPEN } from '@/lib/progress/mode';
import { OUTAGE } from '@/lib/outage';

type PublicSession = { id: string; open: boolean; ta_name?: string; time_slot?: string };
type PublicSessionResponse = PublicSession & { sessions?: PublicSession[]; practice?: boolean; selfPaced?: boolean };

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
  let selfPaced = false; // a lab that is open any time: a permanent session, no TA needed, still tracked
  let staff = false; // TAs, doctors and admins: try every exercise any time, nothing recorded
  let offline = false; // the course database is down: practice only, the form is hidden and the card turns amber
  const title = root.querySelector<HTMLElement>('h2');
  const titleText = title?.textContent ?? '';
  const kicker = root.querySelector<HTMLElement>('.ls-k');
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
    const text = offline
      ? (target.closest('[data-checkin]') ? OUTAGE.checkin : target.closest('[data-repo-submit]') ? OUTAGE.handIn : OUTAGE.lab)
      : access === 'staff'
      ? (ALWAYS_OPEN ? 'Staff preview: hand-ins and check-in are for students. Everything else runs, and nothing is recorded.' : 'Staff preview: hand-ins and check-in are for students in a live session. Everything else runs, and nothing is recorded.')
      : access === 'practice'
      ? 'Hand-ins and check-in need a live lab session. Exercises and demos work now in practice mode.'
      : ALWAYS_OPEN
        // sessions are off: nothing to wait for, the student only has to press Start
        ? (account ? 'Press Start in Start lab (your name and ID are filled in). Then you can edit, run and check.' : 'Start the lab first: enter your name and student ID in Start lab. Then you can edit, run and check.')
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
      if (access !== 'practice' && access !== 'staff' && (ALWAYS_OPEN || sessions.length)) {
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
    // with sessions off the form is always there: the server puts the student in the lab, there is nothing to wait for.
    // With the database down there is nothing to start: the form goes, and the card says what still works.
    form.hidden = offline || (!ALWAYS_OPEN && sessions.length === 0);
    root.classList.toggle('is-offline', offline);
    if (title) title.textContent = offline ? 'Saving is off right now' : titleText;
    if (kicker) kicker.hidden = offline;
    if (labRoot) labRoot.dataset.sessionAccess = current ? 'active' : staff ? 'staff' : practice ? 'practice' : 'readonly';
    formBox.hidden = current;
    signed.hidden = !current;
    root.classList.toggle('is-signed', current);
    submit.disabled = !ALWAYS_OPEN && !session?.open;
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

  let retry = 0;
  const refreshSession = async () => {
    try {
      const response = await fetch(`/api/progress/session?lab=${encodeURIComponent(lab)}`, { cache: 'no-store' });
      // a server error says nothing about the lab: keep what we knew instead of locking it
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as PublicSessionResponse & { offline?: boolean };
      // the database cannot be read: a session we already knew stays (a hiccup); otherwise the lab opens for practice
      if (data.offline && sessions.length) throw new Error('offline');
      sessions = Array.isArray(data.sessions) ? data.sessions.filter((item) => item.open) : data.open ? [data] : [];
      offline = data.offline === true;
      practice = data.practice === true;
      selfPaced = data.selfPaced === true;
      const student = getStudent();
      const previousId = sessionIn.value;
      sessionIn.replaceChildren(...sessions.map((item) => new Option(`${item.time_slot ?? 'Current time slot'} — ${item.ta_name ?? 'TA'}`, item.id)));
      const preferredId = student && sessions.some((item) => item.id === student.sessionId)
        ? student.sessionId
        : sessions.some((item) => item.id === previousId) ? previousId : sessions[0]?.id ?? '';
      sessionIn.value = preferredId;
      session = sessions.find((item) => item.id === preferredId) ?? null;
      sessionField.hidden = sessions.length < 2;
      status.textContent = offline
        ? OUTAGE.lab
        : staff && !getStudent()
        ? `Staff preview: you can edit, run and check every exercise and demo now${ALWAYS_OPEN ? '' : ', without starting a session'}. Nothing you do here is recorded.`
        : ALWAYS_OPEN || (selfPaced && session && sessions.length === 1)
        ? 'This lab is open any time. Enter your name and student ID to start. Your work is saved.'
        : sessions.length > 1
        ? `${sessions.length} sessions are running. Choose your time slot and TA, then enter your details.`
        : session
          ? `Session started by ${session.ta_name ?? 'your TA'} · ${session.time_slot ?? 'current time slot'}. Enter your details to begin.`
        : practice
          ? 'Practice mode is on: you can edit and check every exercise now. Your progress is saved in this browser only and is not sent to your TA.'
        : 'Waiting for your TA to start this lab session. You can read the content in the meantime.';
    } catch {
      // keep the last answer (an open lab stays usable while the network or the server hiccups) and ask again soon
      if (!sessions.length) status.textContent = 'Could not reach the server. Trying again…';
      clearTimeout(retry);
      retry = window.setTimeout(() => { if (root.isConnected) void refreshSession(); }, 4000);
    }
    show();
    void autoJoin();
  };

  /**
   * Signed-in students join the one open session by themselves (once per session), no form needed. In a lab that is
   * open any time, a student who already typed their name and ID here before is taken back in the same way.
   */
  const autoJoin = async () => {
    if (staff || !session?.open || sessions.length !== 1 || autoTried.has(session.id)) return;
    const student = getStudent();
    const back = !account && selfPaced && student && student.sessionId !== session.id ? student : null;
    const who = account ?? back;
    if (!who) return;
    // already in as this account; a classmate's guest identity left on a shared PC is replaced
    if (student && student.sessionId === session.id && student.id === who.id) return;
    autoTried.add(session.id);
    status.textContent = account
      ? (ALWAYS_OPEN ? `Opening the lab for ${account.name}…` : `Joining ${session.ta_name ? `${session.ta_name}’s` : 'the'} session as ${account.name}…`)
      : `Welcome back, ${who.name}. Opening the lab…`;
    const group = account ? looseGroup(groupIn.value) : back && back.group !== '—' ? back.group : '';
    const problem = await join(who.name, who.id, group, session.id);
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
      // Identity is persisted only after verification, with the session the server put the student in
      const joined = typeof data.sessionId === 'string' && data.sessionId ? data.sessionId : sessionId;
      // sessions off: the lab's session is the one the server put the student in (even if the page never got it)
      if (ALWAYS_OPEN && joined && session?.id !== joined) {
        session = { id: joined, open: true };
        sessions = [session];
      }
      setStudent({ name, id, group: group || '—', sessionId: joined });
      setProgressIdentity(name, id, group || '—', joined, sharedDeviceId);
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
    if (!session?.open && !ALWAYS_OPEN) {
      err.textContent = 'Your TA has not started this session yet. You can read the lab content for now.';
      return;
    }
    err.textContent = 'Checking…';
    submit.disabled = true;
    // with sessions off no session is needed: the server puts the student in the lab
    const problem = await join(name, id, group, session?.open ? session.id : '');
    err.textContent = problem ?? '';
    submit.disabled = !ALWAYS_OPEN && !session?.open;
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
    note.textContent = ALWAYS_OPEN
      ? `Signed in as ${u.name}: nothing to type. You join the lab by yourself, and your progress is saved.`
      : `Signed in as ${u.name}: nothing to type. You join the lab session by yourself when your TA starts it, and your progress is saved.`;
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
