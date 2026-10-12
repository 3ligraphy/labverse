/** Student workspace sections. Other modules keep their own overview and labs. */
export const PSYCHOLOGY_MODULE = 'technology-for-psychology';
export function moduleSections(slug: string) {
  return slug === PSYCHOLOGY_MODULE
    ? ['Overview', 'Labs', 'Project', 'Deployment', 'Tools', 'Setup', 'Resources', 'Troubleshooting', 'Assessment']
    : ['Overview', 'Labs', 'Assessment'];
}
export function moduleSectionHref(slug: string, section: string, preview = false) {
  const query = new URLSearchParams();
  if (section.toLowerCase() !== 'overview') query.set('tab', section.toLowerCase());
  if (preview) query.set('preview', '');
  return `/m/${encodeURIComponent(slug)}${query.size ? `?${query}` : ''}`;
}
