import { redirect } from "next/navigation";
import { getSession, type Profile } from "@/lib/resume";
import { Notice } from "./notice";

// Resolves the résumé profile for a page, or returns the screen to show instead.
export async function guard(role?: "admin"): Promise<{ ok: true; profile: Profile } | { ok: false; screen: React.ReactNode }> {
  const session = await getSession();
  if (session.ok) {
    if (role === "admin" && session.profile.role !== "admin") {
      return { ok: false, screen: <Notice title="Admins only">Ask a résumé admin if you need this.</Notice> };
    }
    return { ok: true, profile: session.profile };
  }
  if (session.reason === "signed-out") redirect("/admin/login");
  if (session.reason === "unconfigured") {
    return {
      ok: false,
      screen: (
        <Notice title="Supabase is not configured">
          Set <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in the environment. The public page is serving the bundled seed résumé meanwhile.
        </Notice>
      ),
    };
  }
  return {
    ok: false,
    screen: (
      <Notice title="No résumé profile" showSignOut>
        {session.email} is signed in to Supabase but has no active résumé profile. A résumé admin can add you under Users.
      </Notice>
    ),
  };
}
