import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Static guards on the SQL. Behaviour is verified against a real Postgres
// (see README "Enforced in the database"); these catch the regressions that
// broke it before.
const sql = readFileSync(new URL("../supabase/migrations/0001_resume.sql", import.meta.url), "utf8");

describe("0001_resume.sql", () => {
  it("never lets anon's read policy call a function anon cannot execute", () => {
    const anonPolicy = sql.match(/create policy "resume_versions public read"[\s\S]*?;/)?.[0] ?? "";
    expect(anonPolicy).toMatch(/to anon\b/);
    expect(anonPolicy).not.toMatch(/is_resume_(user|admin)/);
  });

  it("does not grant is_active as writable", () => {
    const writeGrant = sql.match(/grant insert[^;]*;/)?.[0] ?? "";
    expect(writeGrant).not.toContain("is_active");
  });

  it("keys users on the auth user id, not email", () => {
    expect(sql).toMatch(/user_id\s+uuid primary key references auth\.users/);
    expect(sql).not.toMatch(/auth\.jwt\(\) ->> 'email'/);
  });

  it("enables RLS on every table it creates", () => {
    const tables = [...sql.matchAll(/create table if not exists (public\.\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(0);
    for (const t of tables) expect(sql).toContain(`alter table ${t} enable row level security`);
  });
});
