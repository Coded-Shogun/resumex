import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/admin/actions";
import type { Profile } from "@/lib/resume";

export function AdminBar({ profile, current }: { profile: Profile; current: "versions" | "users" }) {
  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`rounded-[10px] px-3 py-1.5 text-sm transition-colors ${active ? "bg-brand-tint font-medium text-fg" : "text-fg-muted hover:bg-sunken hover:text-fg"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b border-line-subtle bg-[var(--nav-glass)] backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <span className="eyebrow">Résumé admin</span>
          <nav className="flex gap-1">
            {tab("/admin", "Versions", current === "versions")}
            {profile.role === "admin" && tab("/admin/users", "Users", current === "users")}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-fg-muted">
          <a href="/" target="_blank" rel="noopener" className="hover:text-fg">View live ↗</a>
          <span className="hidden sm:inline">
            {profile.displayName || profile.email} · <span className="mono-label text-[10px]">{profile.role}</span>
          </span>
          <form action={signOut}>
            <button type="submit" className="btn-ghost" aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
