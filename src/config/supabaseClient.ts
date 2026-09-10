import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Optional Supabase client for offline-first cloud sync.
 *
 * Reads ONLY the public anon configuration (VITE_SUPABASE_URL,
 * VITE_SUPABASE_ANON_KEY). Returns null when unconfigured — the app then
 * runs fully offline and CloudSyncService stays dormant. Never throws
 * during startup merely because Supabase is absent.
 *
 * SECURITY: anon key safety depends on Row Level Security (see
 * docs/SUPABASE_SCHEMA.sql). Never put a service-role key, database
 * password, or private signing key in frontend/mobile code.
 * Isolated from PacketEngine: only CloudSyncService imports this module.
 */

let cached: SupabaseClient | null | undefined;

function readEnv(name: string): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const value = env?.[name];
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

export function isSupabaseConfigured(): boolean {
  return readEnv('VITE_SUPABASE_URL').length > 0 && readEnv('VITE_SUPABASE_ANON_KEY').length > 0;
}

/** Lazy singleton; null when Supabase is not configured. */
export function getSupabaseClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  if (!isSupabaseConfigured()) {
    cached = null;
    return cached;
  }
  try {
    cached = createClient(
      readEnv('VITE_SUPABASE_URL'),
      readEnv('VITE_SUPABASE_ANON_KEY')
    );
  } catch {
    cached = null;
  }
  return cached;
}

/** Test seam: reset the cached singleton between cases. */
export function resetSupabaseClientForTests(): void {
  cached = undefined;
}
