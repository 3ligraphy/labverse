/** Data for onboarding and "my modules": platform settings + every visible module with its audience. */
import { getLabs } from '@/lib/content';
import { BUILT_IN_AUDIENCE, DEFAULT_SETTINGS } from './core';
import { getAccountStore } from './server';
import { moduleCards } from '@/lib/platform/server';

type HubData = Awaited<ReturnType<typeof loadHubData>>;
let cached: { until: number; value: Promise<HubData> } | null = null;

async function loadHubData() {
  const store = getAccountStore();
  const settings = store
    ? await store.getSettings().catch(() => ({ ...DEFAULT_SETTINGS, builtIn: BUILT_IN_AUDIENCE, locked: [] as string[] }))
    : { ...DEFAULT_SETTINGS, builtIn: BUILT_IN_AUDIENCE, locked: [] as string[] };
  // every module is open to everyone unless staff lock its labs (the Lock button on the module page)
  const cards = (await moduleCards(settings.builtIn, (await getLabs()).length, settings.categories)).map((c) => ({ ...c, locked: settings.locked.includes(c.slug) }));
  // electives students may pick as one of their own modules (open ones; Mobile Development by default)
  return { settings, cards, optional: cards.filter((c) => c.kind === 'elective' && c.open).map((c) => c.slug) };
}

/** After a change (a lock), the next request reads fresh data on this server. */
export function forgetHubData() {
  cached = null;
}

/** Shared, public module catalogue data. A short warm-instance cache removes
 * repeated Neon round trips while navigating without making edits feel stale. */
export function hubData(): Promise<HubData> {
  const now = Date.now();
  if (!cached || cached.until <= now) cached = { until: now + 5_000, value: loadHubData() };
  return cached.value.catch((error) => { cached = null; throw error; });
}
