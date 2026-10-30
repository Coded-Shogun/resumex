"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Eye, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { activateVersion, createVersion, deleteVersion, type ActionResult } from "@/app/admin/actions";
import { when } from "@/lib/format";
import type { VersionSummary } from "@/lib/resume";

export function VersionList({ versions, isAdmin }: { versions: VersionSummary[]; isAdmin: boolean }) {
  const [status, setStatus] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const live = versions.find((v) => v.isActive);

  const duplicate = (from: VersionSummary | null) => {
    const label = prompt("Name for the new version:", from ? `${from.label} (copy)` : "New version");
    if (!label) return;
    // On success the action redirects to the new version's editor.
    start(async () => setStatus(await createVersion(from?.id ?? null, label)));
  };

  const activate = (v: VersionSummary) => {
    if (!confirm(`Make "${v.label}" the live résumé? The current live version stays in the list.`)) return;
    start(async () => setStatus(await activateVersion(v.id)));
  };

  const remove = (v: VersionSummary) => {
    if (!confirm(`Delete "${v.label}"? This can't be undone.`)) return;
    start(async () => setStatus(await deleteVersion(v.id)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => duplicate(live ?? null)}>
          <Plus className="h-4 w-4" /> {live ? "New version from live" : "New version"}
        </button>
        {status && (
          <span role="status" className={`text-sm ${status.ok ? "text-success" : "text-destructive"}`}>
            {status.message}
          </span>
        )}
      </div>

      {versions.length === 0 && (
        <p className="m-0 rounded-[18px] bg-elevated p-6 text-sm text-fg-muted">
          No versions yet. Create one: it starts from the bundled CV. The public page shows the bundled CV until a version is live.
        </p>
      )}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {versions.map((v) => (
          <li
            key={v.id}
            className={`flex flex-wrap items-center justify-between gap-4 rounded-[18px] bg-elevated p-5 shadow-sm ${v.isActive ? "ring-2 ring-brand" : ""}`}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <Link href={`/admin/versions/${v.id}`} className="truncate text-[17px] font-medium text-fg hover:text-brand">
                  {v.label}
                </Link>
                {v.isActive && <span className="mono-label rounded-full bg-brand px-2 py-0.5 text-[10px] text-white">Live</span>}
              </div>
              <span className="text-xs text-fg-subtle">
                Edited {when(v.updatedAt)}
                {v.activatedAt && ` · last live ${when(v.activatedAt)}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Link href={`/admin/versions/${v.id}`} className="btn-ghost" title={v.isActive ? "View (locked)" : "Edit"}>
                {v.isActive ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                {v.isActive ? "View" : "Edit"}
              </Link>
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => duplicate(v)}>
                <Copy className="h-4 w-4" /> Duplicate
              </button>
              {isAdmin && !v.isActive && (
                <>
                  <button type="button" className="btn-ghost" disabled={pending} onClick={() => activate(v)}>
                    <Rocket className="h-4 w-4" /> Make live
                  </button>
                  <button type="button" className="btn-ghost hover:!text-destructive" disabled={pending} onClick={() => remove(v)} aria-label={`Delete ${v.label}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
