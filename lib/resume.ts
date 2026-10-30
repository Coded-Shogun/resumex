import "server-only";
import seed from "./seed.json";
import { resumeSchema, type Resume } from "./schema";
import { createClient } from "./supabase/server";

export type Source = "database" | "seed";

export const seedResume: Resume = resumeSchema.parse(seed);

// Public page: the published document. Falls back to the bundled seed when
// Supabase is not configured (local dev) or unreachable, so the page never
// goes blank in front of an interviewer.
export async function getPublished(): Promise<{ resume: Resume; source: Source; publishedAt: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { resume: seedResume, source: "seed", publishedAt: null };

  const { data, error } = await supabase
    .from("resume_content")
    .select("published, published_at")
    .eq("id", "main")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("resume: published read failed:", error.message);
    return { resume: seedResume, source: "seed", publishedAt: null };
  }
  const parsed = resumeSchema.safeParse(data.published);
  if (!parsed.success) {
    console.error("resume: published document failed validation");
    return { resume: seedResume, source: "seed", publishedAt: null };
  }
  return { resume: parsed.data, source: "database", publishedAt: data.published_at };
}

export type AdminSession =
  | { ok: true; email: string }
  | { ok: false; reason: "unconfigured" | "signed-out" | "forbidden"; email?: string };

function envAllows(email: string) {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

// Two gates: ADMIN_EMAILS in the pod env, and resume_admins in the database
// (which the RPCs enforce on their own). Both must agree.
export async function getAdminSession(): Promise<AdminSession> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, reason: "signed-out" };
  if (!envAllows(user.email)) return { ok: false, reason: "forbidden", email: user.email };

  const { data: isAdmin, error } = await supabase.rpc("is_resume_admin");
  if (error || isAdmin !== true) return { ok: false, reason: "forbidden", email: user.email };
  return { ok: true, email: user.email };
}

export async function getDraft(): Promise<{ resume: Resume; draftUpdatedAt: string | null; publishedAt: string | null }> {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.rpc("get_resume_draft").maybeSingle<{
    draft: unknown;
    draft_updated_at: string;
    published_at: string;
  }>();
  if (error) throw new Error(error.message);
  if (!data) return { resume: seedResume, draftUpdatedAt: null, publishedAt: null };
  const parsed = resumeSchema.safeParse(data.draft);
  return {
    resume: parsed.success ? parsed.data : seedResume,
    draftUpdatedAt: data.draft_updated_at,
    publishedAt: data.published_at,
  };
}
