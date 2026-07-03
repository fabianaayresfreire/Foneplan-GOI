import { createClient } from "@supabase/supabase-js";

// Cliente com service_role — usado apenas em operações administrativas server-side
// (criação de usuários). Nunca expõe dados de outros usuários ao browser pois a
// página que o importa já exige papel admin verificado pelo RLS.
const SUPABASE_URL  = "https://ccdquqmuxvcadveaidyc.supabase.co";
const SERVICE_ROLE  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZHF1cW11eHZjYWR2ZWFpZHljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIzNjcxMSwiZXhwIjoyMDk1ODEyNzExfQ.ZU9pMrAb2teAQkTeKOKrMHrgfI48APin4SGgH8W8nk8";

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});
