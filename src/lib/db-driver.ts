/**
 * Which Postgres driver a connection string needs. Neon's HTTP driver only talks to Neon, so it is used for
 * neon.tech hosts on Vercel; every other Postgres (Supabase, Aiven, a laptop) goes through node-postgres.
 */
export type Driver = 'neon' | 'postgres';

export function driverFor(url: string, onVercel: boolean): Driver {
  if (!onVercel) return 'postgres';
  let host = '';
  try { host = new URL(url).hostname; } catch { /* not a URL: treat as plain Postgres */ }
  return /(^|\.)neon\.tech$/i.test(host) ? 'neon' : 'postgres';
}

/** node-postgres pool settings: serverless functions keep few connections and let idle ones go quickly. */
export const POOL_OPTIONS = { max: 3, idleTimeoutMillis: 10_000, allowExitOnIdle: true } as const;
