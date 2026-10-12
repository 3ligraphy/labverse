/**
 * Faculty → year → specialization on the sign-up, profile and onboarding forms. The faculty select
 * ([name=faculty] inside [data-faculty-field]) is hidden while the catalogue has one faculty (the server then
 * records that one). The specialization select lists only the chosen faculty's specializations. Students choose a
 * specialization only from the year it starts (Year 2 by default); before that the field is hidden and they are
 * "General", as the server records it.
 */
import { DEFAULT_FACULTY, GENERAL, hasSpecialization, type Faculty, type Semester } from '@/lib/accounts/core';

export type StudyConfig = { years: string[]; activeSemester: Semester; specFrom: { year: string; semester: Semester }; faculties: Faculty[] };

export function wireStudyFields(form: HTMLFormElement, cfg: StudyConfig, onChange?: () => void) {
  const year = form.querySelector<HTMLSelectElement>('[name=year]')!;
  const spec = form.querySelector<HTMLSelectElement>('[name=specialization]')!;
  const fac = form.querySelector<HTMLSelectElement>('[name=faculty]');
  const field = spec.closest<HTMLElement>('[data-spec-field]') ?? spec;
  const note = form.querySelector<HTMLElement>('[data-spec-note]');
  const faculties = cfg.faculties?.length ? cfg.faculties : [];
  const one = faculties.length <= 1;
  if (fac) {
    (fac.closest<HTMLElement>('[data-faculty-field]') ?? fac).hidden = one;
    fac.disabled = one; // one faculty: nobody chooses it
    fac.required = !one;
  }
  const faculty = () => (one ? faculties[0]?.slug ?? DEFAULT_FACULTY : fac?.value ?? '');
  const starts = `${cfg.specFrom.year}${cfg.specFrom.semester === 'Semester 1' ? '' : ` (${cfg.specFrom.semester})`}`;
  const on = () => Boolean(year.value) && hasSpecialization(cfg, year.value, cfg.activeSemester);
  /** the chosen faculty's specializations (keeps the current choice when it is still listed) */
  const fillSpecs = () => {
    const f = faculties.find((x) => x.slug === faculty());
    if (!f && !fac) return; // no faculty data: keep the server-rendered list
    const keep = spec.value;
    spec.replaceChildren(
      new Option(f ? 'Choose…' : 'Choose your faculty first…', '', false, !f?.specializations.includes(keep)),
      ...(f?.specializations ?? []).map((s) => new Option(s, s, false, s === keep)),
    );
  };
  const sync = (notify = true) => {
    const pick = on();
    field.hidden = !pick;
    spec.disabled = !pick; // a disabled field is not sent; the server records "General"
    spec.required = pick;
    if (!pick) spec.removeAttribute('aria-invalid');
    if (note) {
      note.hidden = !year.value || pick;
      note.textContent = `${year.value} follows the general programme. You choose your specialization from ${starts}.`;
    }
    if (notify) onChange?.();
  };
  fac?.addEventListener('change', () => { fillSpecs(); sync(); });
  year.addEventListener('change', () => sync());
  spec.addEventListener('change', () => onChange?.());
  fillSpecs();
  sync(false); // the caller renders its first state itself
  return {
    /** the faculty slug ('' while not chosen) */
    faculty,
    year: () => year.value,
    /** the specialization to match modules against: "General" before it starts, '' while not chosen yet */
    specialization: () => (!year.value ? '' : on() ? spec.value : GENERAL),
  };
}
