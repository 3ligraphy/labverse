/**
 * Where a module sits on the site, for breadcrumbs: All modules › Faculty › Year › Module (› Lab). The year is shown
 * when the module is for one year; the faculty when it is not for every faculty. Links open All modules on that
 * faculty (and scroll to that year).
 */
/** the id of a year's section on All modules (one per faculty) */
export const yearId = (year: string, faculty: string) => `${faculty}-${year.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export type Crumb = { label: string; href: string };

export function moduleTrail(meta: { faculty?: string; years?: string }, faculties: { slug: string; name: string }[]): Crumb[] {
  const faculty = faculties.find((f) => f.slug === meta.faculty);
  const years = (meta.years ?? '').split(',').map((y) => y.trim()).filter(Boolean);
  const trail: Crumb[] = [{ label: 'All modules', href: '/modules' }];
  if (faculty) trail.push({ label: faculty.name, href: `/modules?faculty=${encodeURIComponent(faculty.slug)}` });
  if (faculty && years.length === 1) trail.push({ label: years[0], href: `/modules?faculty=${encodeURIComponent(faculty.slug)}#${yearId(years[0], faculty.slug)}` });
  return trail;
}
