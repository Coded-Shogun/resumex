import { signOut } from "./actions";

export function Notice({ title, children, showSignOut }: { title: string; children: React.ReactNode; showSignOut?: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-5">
      <div className="flex w-full max-w-[460px] flex-col gap-4 rounded-[24px] bg-elevated p-8 shadow-md">
        <span className="eyebrow">Résumé admin</span>
        <h1 className="m-0 text-[24px] font-medium">{title}</h1>
        <div className="text-sm leading-[1.6] text-fg-muted">{children}</div>
        {showSignOut && (
          <form action={signOut}>
            <button type="submit" className="btn-secondary">Sign out</button>
          </form>
        )}
      </div>
    </main>
  );
}
