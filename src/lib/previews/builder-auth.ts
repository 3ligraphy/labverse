/**
 * AUTO BUILDS — who may act as the app builder without a staff session: only the App builds workflow of this repo
 * on main (.github/workflows/app-builds.yml), proven by the OIDC token GitHub signs for each run. Nothing secret is
 * stored anywhere: the site checks GitHub's signature with GitHub's public keys and reads the token's claims.
 * The builder may list hand-ins and upload / register builds; nothing else (src/pages/api/admin/previews).
 */

export const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
export const BUILDER_AUDIENCE = 'buenova-app-builds';
export const BUILDER_REPO = '3ligraphy/labverse';
export const BUILDER_WORKFLOW = '.github/workflows/app-builds.yml';
/** who the builder's saves are recorded as */
export const BUILDER_NAME = 'Auto build (GitHub)';

export type Claims = Record<string, unknown>;
type Jwk = JsonWebKey & { kid?: string };

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const json = (s: string) => JSON.parse(new TextDecoder().decode(b64url(s))) as Record<string, unknown>;

/** The claims of a run of the App builds workflow on main of this repo, still valid at `now` (seconds). */
export function builderClaimsOk(c: Claims, now = Math.floor(Date.now() / 1000), repo = BUILDER_REPO): boolean {
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  const num = (v: unknown) => (typeof v === 'number' ? v : NaN);
  return (
    c.iss === OIDC_ISSUER &&
    aud.includes(BUILDER_AUDIENCE) &&
    String(c.repository ?? '').toLowerCase() === repo.toLowerCase() &&
    c.ref === 'refs/heads/main' &&
    String(c.workflow_ref ?? '').toLowerCase() === `${repo}/${BUILDER_WORKFLOW}@refs/heads/main`.toLowerCase() &&
    (c.event_name === 'schedule' || c.event_name === 'workflow_dispatch') &&
    num(c.exp) > now &&
    !(num(c.nbf) > now + 60) &&
    !(num(c.iat) > now + 60)
  );
}

let jwksCache: { at: number; keys: Jwk[] } | null = null;
async function githubKeys(): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < 60 * 60 * 1000) return jwksCache.keys;
  const res = await fetch(`${OIDC_ISSUER}/.well-known/jwks`);
  if (!res.ok) throw new Error(`GitHub keys: ${res.status}`);
  const keys = ((await res.json()) as { keys?: Jwk[] }).keys ?? [];
  jwksCache = { at: Date.now(), keys };
  return keys;
}

/** The token's claims when GitHub signed it (RS256, one of `keys`), else null. */
export async function verifiedClaims(token: string, keys: readonly Jwk[]): Promise<Claims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = json(parts[0]);
    if (header.alg !== 'RS256') return null;
    const jwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    return ok ? json(parts[1]) : null;
  } catch {
    return null;
  }
}

/** True when the request carries a valid token of the App builds workflow (Authorization: Bearer <OIDC token>). */
export async function isBuilder(request: Request): Promise<boolean> {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token || token.length > 8000) return false;
  try {
    const claims = await verifiedClaims(token, await githubKeys());
    return !!claims && builderClaimsOk(claims);
  } catch (error) {
    console.error('[previews] could not check the builder token', error);
    return false;
  }
}
