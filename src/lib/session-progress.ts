/** Ignore obsolete task IDs, duplicate ticks and malformed browser storage. */
export function sessionProgress(taskIds: string[], saved: unknown) {
  const valid = new Set(taskIds);
  const done = new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && valid.has(id)) : []);
  return { done: done.size, total: valid.size, percent: valid.size ? Math.round(done.size / valid.size * 100) : 0 };
}
