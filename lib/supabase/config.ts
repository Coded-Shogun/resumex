// Read at runtime (not NEXT_PUBLIC_*), so one image runs in any environment
// and the values come from the pod's env (Vault -> ExternalSecret).
export function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

// Distinct cookie name: main-site sets the default sb-* cookie on
// .nativesilicon.co.za against the same Supabase, and we don't want the two
// sessions to collide on this host.
export const AUTH_COOKIE = "resumex-auth";
