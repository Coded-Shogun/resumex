"use client";

import { useActionState } from "react";
import { signIn } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="username" className="field" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <input name="password" type="password" required autoComplete="current-password" className="field" />
      </label>
      {state && !state.ok && <p role="alert" className="m-0 text-sm text-destructive">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
