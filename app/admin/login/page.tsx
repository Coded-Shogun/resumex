import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-5">
      <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-[24px] bg-elevated p-8 shadow-md">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Résumé admin</span>
          <h1 className="m-0 text-[26px] font-medium tracking-[-0.015em]">Sign in</h1>
          <p className="m-0 text-sm text-fg-muted">Use your Supabase account. Only allowlisted emails can edit.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
