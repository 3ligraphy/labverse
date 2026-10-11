/**
 * Asks before an editor with unsaved changes is left, by closing the tab, an in-app link or Back.
 *
 * The site uses Astro's client router, which handles links and Back without a page load, so `beforeunload`
 * alone never fires for them. Calling preventDefault() on `astro:before-preparation` makes the router fall back
 * to a real page load (astro/dist/transitions/router.js), and that load fires `beforeunload`, so the browser
 * shows its usual "Leave site?" prompt. Staying keeps the editor and its changes.
 * Listeners are removed once the page is swapped for another one.
 */
export function guardUnsaved(isDirty: () => boolean): void {
  const onUnload = (e: BeforeUnloadEvent) => {
    if (!isDirty()) return;
    e.preventDefault();
    e.returnValue = ''; // older Safari and Chrome only prompt when this is set
  };
  const onNavigate = (e: Event) => { if (isDirty()) e.preventDefault(); };
  addEventListener('beforeunload', onUnload);
  document.addEventListener('astro:before-preparation', onNavigate);
  document.addEventListener('astro:after-swap', () => {
    removeEventListener('beforeunload', onUnload);
    document.removeEventListener('astro:before-preparation', onNavigate);
  }, { once: true });
}
