/** per-widget memory in this browser (drafts, answers) */
export const store = {
  get<T extends Record<string, unknown>>(id: string): Partial<T> { try { return JSON.parse(localStorage.getItem(`ai:${id}`) ?? '{}'); } catch { return {}; } },
  set(id: string, patch: Record<string, unknown>) { try { localStorage.setItem(`ai:${id}`, JSON.stringify({ ...store.get(id), ...patch })); } catch { /* storage off */ } },
};

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reducedMotion() ? 0 : ms));
