/**
 * Year → specialization on the sign-up and profile forms. Students choose a specialization only from the year it
 * starts (Year 2 by default); before that the field is hidden and they are "General", as the server records it.
 */
import { GENERAL, hasSpecialization, type Semester } from '@/lib/accounts/core';

export type StudyConfig = { years: string[]; activeSemester: Semester; specFrom: { year: string; semester: Semester } };

export function wireStudyFields(form: HTMLFormElement, cfg: StudyConfig, onChange?: () => void) {
  const year = form.querySelector<HTMLSelectElement>('[name=year]')!;
  const spec = form.querySelector<HTMLSelectElement>('[name=specialization]')!;
  const field = spec.closest<HTMLElement>('[data-spec-field]') ?? spec;
  const note = form.querySelector<HTMLElement>('[data-spec-note]');
  const starts = `${cfg.specFrom.year}${cfg.specFrom.semester === 'Semester 1' ? '' : ` (${cfg.specFrom.semester})`}`;
  const on = () => Boolean(year.value) && hasSpecialization(cfg, year.value, cfg.activeSemester);
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
  year.addEventListener('change', () => sync());
  spec.addEventListener('change', () => onChange?.());
  sync(false); // the caller renders its first state itself
  return {
    year: () => year.value,
    /** the specialization to match modules against: "General" before it starts, '' while not chosen yet */
    specialization: () => (!year.value ? '' : on() ? spec.value : GENERAL),
  };
}
