import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/resume";
import { Notice } from "./notice";

// Resolves the admin session for a page, or returns the screen to show instead.
export async function guard(): Promise<{ ok: true; email: string } | { ok: false; screen: React.ReactNode }> {
  const session = await getAdminSession();
  if (session.ok) return { ok: true, email: session.email };
  if (session.reason === "signed-out") redirect("/admin/login");
  if (session.reason === "unconfigured") {
    return {
      ok: false,
      screen: (
        <Notice title="Supabase is not configured">
          Set <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code> and <code>ADMIN_EMAILS</code> in the environment. The public page is serving the bundled seed résumé meanwhile.
        </Notice>
      ),
    };
  }
  return {
    ok: false,
    screen: (
      <Notice title="Not authorised" showSignOut>
        {session.email} is signed in but is not a résumé admin. It must be in both <code>ADMIN_EMAILS</code> and the <code>resume_admins</code> table.
      </Notice>
    ),
  };
}
