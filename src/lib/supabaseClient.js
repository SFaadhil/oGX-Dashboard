import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'lead_documents';

// True once real credentials are in .env. Every page degrades to an explicit
// "not configured" state instead of throwing when this is false.
export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('YOUR-PROJECT-REF') && !anonKey.includes('YOUR-ANON')
);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

export function publicFileUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!supabase) return null;
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

export async function uploadFile(file, prefix = 'doc') {
  if (!supabase) throw new Error('Supabase is not configured.');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const key = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(key, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  return { path: key, url: publicFileUrl(key) };
}
