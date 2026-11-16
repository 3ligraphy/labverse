/**
 * '@supabase/supabase-js' in the lab preview. createClient() gives:
 *   - the practice project (supabase-practice.ts) for https://practice.supabase.co: no account needed, lives in this preview;
 *   - the real supabase-js for any other project (the student's own), loaded before their code runs (core.ts → prepare).
 * A secret key is refused at once: it must never be in an app.
 */
import { createPracticeClient, isPracticeUrl, resolvePracticeUri } from './supabase-practice.ts';

// <Image source={{ uri: publicUrl }} /> of a practice file shows the stored picture (rn-shim.ts → ImageBase)
(globalThis as { __labResolveUri?: unknown }).__labResolveUri = resolvePracticeUri;

type RealLib = { createClient: (url: string, key: string, options?: object) => unknown };
const realLib = () => (globalThis as { __labSupabaseReal?: RealLib }).__labSupabaseReal;

function hinted(message: string, hint: string) {
  const e = new Error(message);
  (e as Error & { hint?: string }).hint = hint;
  return e;
}

/** A real project address (not the practice one) somewhere in these files: the real library must be loaded. */
export const needsRealSupabase = (text: string) => /https:\/\/(?!practice\.)[a-z0-9-]+\.supabase\.co/i.test(text);

export function createClient(url: string, key: string, options?: { auth?: object }) {
  if (typeof url !== 'string' || !url.trim()) {
    throw hinted('supabaseUrl is required.', 'Put your project URL in .env as EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co and read it with process.env.EXPO_PUBLIC_SUPABASE_URL.');
  }
  if (!/^https?:\/\//i.test(url)) throw hinted('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.', 'Copy the Project URL from your Supabase dashboard: it starts with https://');
  if (typeof key !== 'string' || !key.trim()) throw hinted('supabaseKey is required.', 'Put the publishable key in .env as EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…');
  if (/^sb_secret_/.test(key) || /service_role/.test(key)) {
    throw hinted('A secret key must never be in an app.', 'Anyone can read an app’s code. Use the publishable key (sb_publishable_…) here, and protect the data with Row Level Security.');
  }
  if (isPracticeUrl(url)) return createPracticeClient(url, key, options as never);
  const lib = realLib();
  if (!lib) throw hinted('Your Supabase project could not be loaded in this preview.', 'Run the app again in a moment. If it keeps failing, check the project URL in your .env file.');
  return lib.createClient(url, key, options);
}
