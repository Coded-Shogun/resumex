"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { removeUser, setUserActive, upsertUser, type ActionResult } from "@/app/admin/actions";
import { when } from "@/lib/format";
import type { ResumeUser } from "@/lib/resume";

export function UsersManager({ users, selfId }: { users: ResumeUser[]; selfId: string }) {
  const [addState, addAction, adding] = useActionState(upsertUser, null);
  const [status, setStatus] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const shown = status ?? addState;

  const changeRole = (u: ResumeUser, role: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set("email", u.email);
      fd.set("role", role);
      setStatus(await upsertUser(null, fd));
    });

  return (
    <div className="flex flex-col gap-6">
      <form action={addAction} className="flex flex-col gap-4 rounded-[18px] bg-elevated p-5 shadow-sm" onSubmit={() => setStatus(null)}>
        <h2 className="m-0 text-[17px] font-medium">Add or update a user</h2>
        <p className="m-0 text-sm text-fg-muted">
          They sign in with their existing Supabase account (for example their Native Books login). Create the account in Supabase Studio first if they don&apos;t have one.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium text-fg-muted">
            Email
            <input name="email" type="email" required className="field" />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium text-fg-muted">
            Display name (optional)
            <input name="displayName" className="field" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-fg-muted">
            Role
            <select name="role" defaultValue="editor" className="field">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" className="btn-primary" disabled={adding}>
            <UserPlus className="h-4 w-4" /> Save
          </button>
        </div>
      </form>

      {shown && (
        <p role="status" className={`m-0 text-sm ${shown.ok ? "text-success" : "text-destructive"}`}>
          {shown.message}
        </p>
      )}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {users.map((u) => (
          <li key={u.userId} className={`flex flex-wrap items-center justify-between gap-4 rounded-[18px] bg-elevated p-5 shadow-sm ${u.active ? "" : "opacity-60"}`}>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[15px] font-medium">
                {u.displayName || u.email}
                {u.userId === selfId && <span className="ml-2 text-xs text-fg-subtle">(you)</span>}
                {!u.active && <span className="ml-2 text-xs text-destructive">disabled</span>}
              </span>
              <span className="text-xs text-fg-subtle">
                {u.email} · last sign-in {when(u.lastSignInAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label={`Role for ${u.email}`}
                value={u.role}
                disabled={pending}
                onChange={(e) => changeRole(u, e.target.value)}
                className="field !w-auto !py-1.5 text-sm"
              >
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => start(async () => setStatus(await setUserActive(u.userId, !u.active)))}>
                {u.active ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                className="btn-ghost hover:!text-destructive"
                disabled={pending}
                aria-label={`Remove ${u.email}`}
                onClick={() => {
                  if (confirm(`Remove ${u.email}'s résumé profile?`)) start(async () => setStatus(await removeUser(u.userId)));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="m-0 text-xs text-fg-subtle">There must always be at least one active admin; the database refuses changes that would leave none.</p>
    </div>
  );
}
