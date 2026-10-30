import { AdminBar } from "@/components/admin/admin-bar";
import { VersionList } from "@/components/admin/version-list";
import { listVersions } from "@/lib/resume";
import { guard } from "./guard";

export default async function AdminPage() {
  const g = await guard();
  if (!g.ok) return g.screen;

  const versions = await listVersions();
  return (
    <div className="min-h-screen bg-page">
      <AdminBar profile={g.profile} current="versions" />
      <main className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[26px] font-medium tracking-[-0.015em]">Versions</h1>
          <p className="m-0 text-sm text-fg-muted">
            One version is live at a time. The live version is locked: duplicate it, edit the copy, then make the copy live.
            {g.profile.role === "editor" && " Only admins can change which version is live."}
          </p>
        </div>
        <VersionList versions={versions} isAdmin={g.profile.role === "admin"} />
      </main>
    </div>
  );
}
