import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appConfig } from './env';

let client: SupabaseClient | null = null;

/**
 * Single client for the whole app. Only the publishable key is used (RLS protects the data);
 * service_role never exists on the client. No generated DB types (they need a real project):
 * row shapes are validated with Zod in src/data.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (appConfig.kind !== 'supabase') throw new Error('Supabase tidak dikonfigurasi.');
  client = createClient(appConfig.url, appConfig.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // No magic link / OAuth, so no session token is ever read from the URL.
      detectSessionInUrl: false,
    },
  });
  return client;
}
