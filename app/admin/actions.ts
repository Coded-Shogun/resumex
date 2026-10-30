"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, seedResume, type Profile } from "@/lib/resume";
import { resumeSchema } from "@/lib/schema";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message: string; at?: string; pdfUrl?: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The database enforces every rule below on its own (RLS + RPC checks); these
// guards just turn a refusal into a clear message instead of a Postgres error.
async function requireProfile(role?: "admin"): Promise<{ profile: Profile; supabase: NonNullable<Awaited<ReturnType<typeof createClient>>> }> {
  const session = await getSession();
  if (!session.ok) throw new Error("Not signed in, or no résumé profile.");
  if (role === "admin" && session.profile.role !== "admin") throw new Error("Only admins can do that.");
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return { profile: session.profile, supabase };
}

function fail(e: unknown): ActionResult {
  return { ok: false, message: (e as Error).message };
}

function cleanLabel(label: unknown) {
  return String(label ?? "").trim().slice(0, 120);
}

// ── Session ──────────────────────────────────────────────────────────────────
export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "SUPABASE_URL / SUPABASE_ANON_KEY are not set." };
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Same message for unknown user and wrong password.
  if (error) return { ok: false, message: "Invalid email or password." };
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect("/admin/login");
}

// ── Versions ─────────────────────────────────────────────────────────────────
// New version: a copy of `fromId`, or of the bundled seed when there is none.
export async function createVersion(fromId: string | null, label: string): Promise<ActionResult> {
  let newId: string;
  try {
    const { supabase } = await requireProfile();
    const name = cleanLabel(label);
    if (!name) return { ok: false, message: "Give the version a name." };

    let document: unknown = seedResume;
    if (fromId) {
      if (!UUID.test(fromId)) return { ok: false, message: "Unknown version." };
      const { data, error } = await supabase.from("resume_versions").select("document").eq("id", fromId).maybeSingle();
      if (error || !data) return { ok: false, message: "Could not read the version to copy." };
      document = data.document;
    }
    const { data, error } = await supabase.from("resume_versions").insert({ label: name, document }).select("id").single();
    if (error) return { ok: false, message: `Not created: ${error.message}` };
    newId = data.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin");
  redirect(`/admin/versions/${newId}`);
}

export async function saveVersion(id: string, label: string, doc: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await requireProfile();
    if (!UUID.test(id)) return { ok: false, message: "Unknown version." };
    const name = cleanLabel(label);
    if (!name) return { ok: false, message: "Give the version a name." };
    const parsed = resumeSchema.safeParse(doc);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, message: `Not saved: ${issue.path.join(".") || "document"} — ${issue.message}` };
    }
    // RLS refuses updates to the active version; zero rows back means locked.
    const { data, error } = await supabase
      .from("resume_versions")
      .update({ label: name, document: parsed.data })
      .eq("id", id)
      .select("updated_at");
    if (error) return { ok: false, message: `Not saved: ${error.message}` };
    if (!data?.length) return { ok: false, message: "Not saved: this version is live and locked. Duplicate it to make changes." };
    revalidatePath("/admin");
    return { ok: true, message: "Saved.", at: data[0].updated_at };
  } catch (e) {
    return fail(e);
  }
}

export async function activateVersion(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireProfile("admin");
    if (!UUID.test(id)) return { ok: false, message: "Unknown version." };
    const { data, error } = await supabase.rpc("activate_resume_version", { p_id: id });
    if (error) return { ok: false, message: `Not activated: ${error.message}` };
    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true, message: "This version is now live on the public page.", at: data as string };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteVersion(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireProfile("admin");
    if (!UUID.test(id)) return { ok: false, message: "Unknown version." };
    const { data, error } = await supabase.from("resume_versions").delete().eq("id", id).select("id");
    if (error) return { ok: false, message: `Not deleted: ${error.message}` };
    if (!data?.length) return { ok: false, message: "Not deleted: the live version can't be deleted." };
    revalidatePath("/admin");
    return { ok: true, message: "Version deleted." };
  } catch (e) {
    return fail(e);
  }
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

// Uploads to the public "resume" bucket under a timestamped name (so browsers
// and Cloudflare never serve a stale copy) and returns its public URL. The
// editor puts that URL in the version; it is public once that version is live.
export async function uploadPdf(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await requireProfile();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a PDF first." };
    if (file.type !== "application/pdf") return { ok: false, message: "Only PDF files are accepted." };
    if (file.size > MAX_PDF_BYTES) return { ok: false, message: "PDF is larger than 10 MB." };

    const path = `cv-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
    const { error } = await supabase.storage.from("resume").upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error) return { ok: false, message: `Upload failed: ${error.message}` };
    const { data } = supabase.storage.from("resume").getPublicUrl(path);
    return { ok: true, message: "PDF uploaded. Save the version to keep it.", pdfUrl: data.publicUrl };
  } catch (e) {
    return fail(e);
  }
}

// ── Users (admin only) ───────────────────────────────────────────────────────
export async function upsertUser(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await requireProfile("admin");
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role") ?? "editor");
    const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80);
    if (!email) return { ok: false, message: "Enter the email of their Supabase account." };
    if (role !== "admin" && role !== "editor") return { ok: false, message: "Role must be admin or editor." };
    const { error } = await supabase.rpc("upsert_resume_user", { p_email: email, p_role: role, p_display_name: displayName });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/users");
    return { ok: true, message: `${email} is now a résumé ${role}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireProfile("admin");
    if (!UUID.test(userId)) return { ok: false, message: "Unknown user." };
    const { error } = await supabase.rpc("set_resume_user_active", { p_user_id: userId, p_active: active });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/users");
    return { ok: true, message: active ? "User re-enabled." : "User disabled." };
  } catch (e) {
    return fail(e);
  }
}

export async function removeUser(userId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireProfile("admin");
    if (!UUID.test(userId)) return { ok: false, message: "Unknown user." };
    const { error } = await supabase.rpc("remove_resume_user", { p_user_id: userId });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/users");
    return { ok: true, message: "Résumé profile removed. Their Supabase account is untouched." };
  } catch (e) {
    return fail(e);
  }
}
