import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False until VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are set (e.g. Supabase project not created yet) — callers should fall back to a "not set up" state instead of calling into `supabase`. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
