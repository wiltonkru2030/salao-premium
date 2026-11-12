import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

export const SUPABASE_URL = 'https://vlifbvzlyzoncefvfgol.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_XBXtJ5YbB1rwda7AoAIrwQ_1FR1TfIJ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});
