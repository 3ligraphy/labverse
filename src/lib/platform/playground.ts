import type { Flow } from './core.ts';
export const PLAYGROUND_FALLBACK = 'https://playground.wordpress.net/';
export const PLAYGROUND_RECOVERY = [
  '**Stuck? Playground says “had a hiccup”?** This message alone does not identify the cause.',
  '',
  '**Console says `sw.js` returned `403`?** The browser could not download Playground’s required service worker. Open the link in a normal Chrome or Edge window outside an embedded/in-app browser. If it still fails, check the Network entry for `sw.js` and share its response with your instructor or network administrator. A temporary site cannot fix a blocked script.',
  '',
  '**Only browser-storage (`OPFS`) errors remain?** Try another browser profile, keeping the original profile and any backups. A [temporary diagnostic site](https://playground.wordpress.net/?storage=temp) can help isolate persistence problems, but its work is lost when the tab closes or reloads. Use it only to test startup, not for your session work.',
  '',
  '1. Keep any existing work and ZIP backups. Do not clear browser/site data: it may contain your saved site.',
  '2. Open **Plain WordPress — startup fallback** below in a normal browser tab. This link does not request the starter theme or animation plugin.',
  '3. If it loads, start a new site only if you have not begun the lab. If you already have work, open **Playgrounds** or use **New → Import zip** to restore your backup.',
  '4. On a fresh fallback site, open **Appearance → Themes** and activate **Twenty Twenty-Five**. Install it with **Add New Theme** if it is absent. Add **Blocks Animation** through **Plugins → Add New Plugin** when you reach the animation task in Session 2.',
  '5. If the plain site also fails, try another browser to check whether the issue is browser-specific. Keep your saved work in the original browser.',
  '6. Still failing? Open Developer Tools (**F12**, then **Console**) and share the first red error with your instructor, along with the full Playground address and whether this was a new site or an imported backup.',
  '',
  '[Official Playground troubleshooting](https://developer.wordpress.org/playground/handbook/troubleshooting/).',
].join('\n');

/** Patch only the launch help; preserve authored content and existing progress identifiers. */
export function addPlaygroundRecovery(input: Flow): Flow {
  const flow = structuredClone(input);
  const help = flow.nodes.find((n) => n.id === 'stuck-launch');
  if (!help) return flow;
  help.data.body = PLAYGROUND_RECOVERY;
  if (flow.nodes.some((n) => n.id === 'link-playground-fallback')) return flow;
  const exits = flow.edges.filter((e) => e.from === help.id);
  if (exits.length !== 1) throw new Error('Expected one path after Playground launch help.');
  flow.nodes.push({ id: 'link-playground-fallback', type: 'link', x: help.x + 360, y: help.y,
    data: { title: 'Plain WordPress — startup fallback', url: PLAYGROUND_FALLBACK, description: 'Start without the course theme/plugin downloads. Follow the recovery steps above to continue the lab.', cta: 'Open plain WordPress' } });
  flow.edges = flow.edges.filter((e) => e !== exits[0]);
  flow.edges.push({ from: help.id, to: 'link-playground-fallback' }, { from: 'link-playground-fallback', to: exits[0].to });
  return flow;
}
