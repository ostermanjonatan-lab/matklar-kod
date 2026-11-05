import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'receptapp_supabase_url';
const STORAGE_ANON_KEY = 'receptapp_supabase_anon_key';

// Auto-check URL hash if someone opened a shared config link
if (typeof window !== 'undefined') {
  try {
    const hash = window.location.hash;
    if (hash && hash.includes('sb_url=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const u = params.get('sb_url');
      const k = params.get('sb_key');
      if (u && k) {
        localStorage.setItem(STORAGE_URL_KEY, u.trim());
        localStorage.setItem(STORAGE_ANON_KEY, k.trim());
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  } catch (e) {
    console.warn('URL hash config parse error:', e);
  }
}

function cleanSupabaseUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = localStorage.getItem(STORAGE_URL_KEY) || '';
  const storedKey = localStorage.getItem(STORAGE_ANON_KEY) || '';

  const url = cleanSupabaseUrl(storedUrl || envUrl);
  const anonKey = storedKey.trim() || envKey.trim();

  const isConfigured = Boolean(url && anonKey && url.startsWith('http'));

  return { url, anonKey, isConfigured };
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  const cleanUrl = cleanSupabaseUrl(url);
  const cleanKey = anonKey.trim();

  if (cleanUrl && cleanKey) {
    localStorage.setItem(STORAGE_URL_KEY, cleanUrl);
    localStorage.setItem(STORAGE_ANON_KEY, cleanKey);
    try {
      fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, anonKey: cleanKey }),
      }).catch(() => {});
    } catch {}
  } else {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_ANON_KEY);
    try {
      fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: '', anonKey: '' }),
      }).catch(() => {});
    } catch {}
  }

  cachedClient = null;
}

/**
 * Syncs Supabase configuration automatically with the local Vite server:
 * - If this device (computer) already has the keys, it saves them to the server.
 * - If this device (phone) does not have keys, it pulls them from the server!
 */
let hasSynced = false;

export async function syncServerSupabaseConfig(): Promise<{ url: string; anonKey: string; isConfigured: boolean }> {
  if (hasSynced) return getSupabaseConfig();
  hasSynced = true;

  const current = getSupabaseConfig();

  // If local device already has credentials (e.g. user entered them on the computer), push to server
  if (current.isConfigured) {
    try {
      await fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: current.url, anonKey: current.anonKey }),
      });
    } catch {
      // Ignore network errors
    }
    return current;
  }

  // If local device (e.g. phone) doesn't have credentials yet, fetch them from server!
  try {
    const res = await fetch('/api/supabase-config');
    if (res.ok) {
      const data = await res.json();
      if (data.url && data.anonKey) {
        localStorage.setItem(STORAGE_URL_KEY, data.url.trim());
        localStorage.setItem(STORAGE_ANON_KEY, data.anonKey.trim());
        cachedClient = null;
        return { url: data.url.trim(), anonKey: data.anonKey.trim(), isConfigured: true };
      }
    }
  } catch {
    // Ignore network errors
  }

  return getSupabaseConfig();
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  if (cachedClient && lastUrl === url && lastKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    lastUrl = url;
    lastKey = anonKey;
    return cachedClient;
  } catch (e) {
    console.error('Error initializing Supabase client:', e);
    return null;
  }
}
