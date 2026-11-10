/** Student workspace sections. Other modules keep their own overview and labs. */
export const PSYCHOLOGY_MODULE = 'technology-for-psychology';
/** AI FOR CODING has its module rubric on a tab of its own (/ai-for-coding?tab=rubric). */
export const AI_FOR_CODING_MODULE = 'ai-for-coding';
export function moduleSections(slug: string) {
  if (slug === PSYCHOLOGY_MODULE) return ['Overview', 'Labs', 'Project', 'Deployment', 'Tools', 'Setup', 'Resources', 'Troubleshooting'];
  if (slug === AI_FOR_CODING_MODULE) return ['Overview', 'Labs', 'Rubric'];
  return ['Overview', 'Labs'];
}
export function moduleSectionHref(slug: string, section: string, preview = false) {
  const query = new URLSearchParams();
  if (section.toLowerCase() !== 'overview') query.set('tab', section.toLowerCase());
  if (preview) query.set('preview', '');
  return `/${encodeURIComponent(slug)}${query.size ? `?${query}` : ''}`;
}
