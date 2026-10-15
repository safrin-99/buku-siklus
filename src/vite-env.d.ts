/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://xxxx.supabase.co. Not a secret. */
  readonly VITE_SUPABASE_URL?: string;
  /** Publishable (or anon) key. NEVER put a secret / service_role key here. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
