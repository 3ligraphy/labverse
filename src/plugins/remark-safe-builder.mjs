/**
 * Markdown typed in /admin/builder is shown to every enrolled student and to the super admin, on the same origin
 * as the admin APIs, and module-level staff can write it. So builder text gets plain Markdown only: raw HTML is
 * dropped (no <script>, no onerror= attributes) and links or images with a scheme other than http(s) or mailto
 * (javascript:, data:, vbscript:…) point nowhere. Relative links and #anchors are kept. File-based MDX labs,
 * written in the repo, do not use this plugin.
 */
const ALLOWED_SCHEME = /^(https?|mailto):/i;
const HAS_SCHEME = /^\s*[a-z][a-z0-9+.\-]*:/i;

export const unsafeUrl = (url = '') => {
  const clean = url.replace(/[\u0000- ]/g, ''); // browsers ignore control characters and spaces inside a scheme
  return HAS_SCHEME.test(clean) && !ALLOWED_SCHEME.test(clean);
};

export default function remarkSafeBuilder() {
  const walk = (node) => {
    if (!Array.isArray(node.children)) return;
    node.children = node.children.filter((child) => child.type !== 'html');
    for (const child of node.children) {
      if ((child.type === 'link' || child.type === 'image' || child.type === 'definition') && unsafeUrl(child.url)) child.url = '#';
      walk(child);
    }
  };
  return (tree) => walk(tree);
}
