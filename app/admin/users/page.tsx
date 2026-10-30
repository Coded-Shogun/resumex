import { AdminBar } from "@/components/admin/admin-bar";
import { UsersManager } from "@/components/admin/users-manager";
import { listUsers } from "@/lib/resume";
import { guard } from "../guard";

export default async function UsersPage() {
  const g = await guard("admin");
  if (!g.ok) return g.screen;

  const users = await listUsers();
  return (
    <div className="min-h-screen bg-page">
      <AdminBar profile={g.profile} current="users" />
      <main className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[26px] font-medium tracking-[-0.015em]">Users</h1>
          <p className="m-0 text-sm text-fg-muted">
            Admins manage users and choose the live version. Editors create and edit versions.
          </p>
        </div>
        <UsersManager users={users} selfId={g.profile.userId} />
      </main>
    </div>
  );
}
