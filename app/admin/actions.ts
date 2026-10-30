"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/resume";
import { resumeSchema } from "@/lib/schema";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message: string; at?: string; pdfUrl?: string } | { ok: false; message: string };

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.ok) throw new Error("Not authorised");
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

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

export async function saveDraft(doc: unknown): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const parsed = resumeSchema.safeParse(doc);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, message: `Not saved: ${issue.path.join(".") || "document"} — ${issue.message}` };
    }
    const { data, error } = await supabase.rpc("save_resume_draft", { doc: parsed.data });
    if (error) return { ok: false, message: `Not saved: ${error.message}` };
    revalidatePath("/admin");
    return { ok: true, message: "Draft saved.", at: data as string };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function publish(): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { data, error } = await supabase.rpc("publish_resume");
    if (error) return { ok: false, message: `Not published: ${error.message}` };
    revalidatePath("/");
    return { ok: true, message: "Published — the public page is live.", at: data as string };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

// Uploads to the public "resume" bucket under a timestamped name (so browsers
// and Cloudflare never serve a stale copy) and returns its public URL. The
// editor puts that URL in the draft; it goes live on the next publish.
export async function uploadPdf(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
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
    return { ok: true, message: "PDF uploaded. Save and publish to make it live.", pdfUrl: data.publicUrl };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
