/**
 * The real supabase-js, bundled on its own (public/lab-runtime/supabase.js by scripts/lab-runtime.mjs). The preview
 * loads it only when a student's code uses their own Supabase project (src/lab/runtime/core.ts → prepare), so the
 * other labs never download it. It sets globalThis.__labSupabaseReal, which src/lab/runtime/supabase.ts uses.
 */
import { createClient } from '@supabase/supabase-js';

(globalThis as { __labSupabaseReal?: unknown }).__labSupabaseReal = { createClient };
