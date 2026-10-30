import "server-only";
import seed from "./seed.json";
import { resumeSchema, type Resume } from "./schema";
import { createClient } from "./supabase/server";

export const seedResume: Resume = resumeSchema.parse(seed);

function parse(doc: unknown): Resume {
  const parsed = resumeSchema.safeParse(doc);
  return parsed.success ? parsed.data : seedResume;
}

// Public page: the active version. Falls back to the bundled seed when
// Supabase is not configured (local dev), unreachable, or has no active
// version, so the page never goes blank in front of an interviewer.
export async function getActive(): Promise<{ resume: Resume; activatedAt: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { resume: seedResume, activatedAt: null };

  const { data, error } = await supabase
    .from("resume_versions")
    .select("document, activated_at")
    .eq("is_active", true)
    .maybeSingle();
  if (error) console.error("resume: active version read failed:", error.message);
  if (!data) return { resume: seedResume, activatedAt: null };
  const parsed = resumeSchema.safeParse(data.document);
  if (!parsed.success) {
    console.error("resume: active version failed validation");
    return { resume: seedResume, activatedAt: null };
  }
  return { resume: parsed.data, activatedAt: data.activated_at };
}

export type Role = "admin" | "editor";
export type Profile = { userId: string; email: string; displayName: string; role: Role };

export type Session =
  | { ok: true; profile: Profile }
  | { ok: false; reason: "unconfigured" | "signed-out" | "no-profile"; email?: string };

// Signed in with Supabase AND has an active row in resume_users. The database
// enforces the same rule on every read and write; this decides what to render.
export async function getSession(): Promise<Session> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "signed-out" };

  const { data } = await supabase
    .from("resume_users")
    .select("display_name, role, active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data?.active) return { ok: false, reason: "no-profile", email: user.email };
  return {
    ok: true,
    profile: { userId: user.id, email: user.email ?? "", displayName: data.display_name, role: data.role as Role },
  };
}

export type VersionSummary = {
  id: string;
  label: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
};
export type Version = VersionSummary & { resume: Resume };

const SUMMARY_COLUMNS = "id, label, is_active, created_at, updated_at, activated_at";

type VersionRow = {
  id: string;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  document?: unknown;
};

function toSummary(r: VersionRow): VersionSummary {
  return { id: r.id, label: r.label, isActive: r.is_active, createdAt: r.created_at, updatedAt: r.updated_at, activatedAt: r.activated_at };
}

async function client() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export async function listVersions(): Promise<VersionSummary[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("resume_versions")
    .select(SUMMARY_COLUMNS)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as VersionRow[]).map(toSummary);
}

export async function getVersion(id: string): Promise<Version | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("resume_versions")
    .select(`${SUMMARY_COLUMNS}, document`)
    .eq("id", id)
    .maybeSingle<VersionRow>();
  if (error) throw new Error(error.message);
  return data ? { ...toSummary(data), resume: parse(data.document) } : null;
}

export type ResumeUser = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export async function listUsers(): Promise<ResumeUser[]> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("list_resume_users");
  if (error) throw new Error(error.message);
  return (data as Array<Record<string, string | boolean | null>>).map((r) => ({
    userId: r.user_id as string,
    email: r.email as string,
    displayName: r.display_name as string,
    role: r.role as Role,
    active: r.active as boolean,
    createdAt: r.created_at as string,
    lastSignInAt: r.last_sign_in_at as string | null,
  }));
}
