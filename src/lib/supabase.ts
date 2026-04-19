import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  "placeholder-anon-key";

if (
  !import.meta.env.VITE_SUPABASE_URL ||
  (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY &&
    !import.meta.env.VITE_SUPABASE_ANON_KEY)
) {
  console.warn(
    "Supabase environment variables are missing. Configure VITE_SUPABASE_URL and either VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY or VITE_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
export const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD ?? "";
