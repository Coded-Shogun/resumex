# resumex

Thendo Siminya's online résumé, served at **https://resume.nativesilicon.co.za**, with a `/admin` side for editing it without rebuilding or redeploying.

- **Public page (`/`)**: renders the *live* version from Supabase on every request. It has a "Download CV" button (an uploaded PDF) and "Print / Save PDF" (A4 print stylesheet). Light and dark themes use the Native Silicon design tokens from `main-site`.
- **Admin (`/admin`)**: sign in with your Supabase account. Any number of named **versions** of the CV; exactly one is **live**. Create a version (a copy of the live one), edit it, preview it, then **Make live**. The previous live version stays in the list, so rolling back is one click. Admins also manage **users**.

Stack: Next.js 16 (App Router, standalone output), React 19, Tailwind v4, TypeScript, zod, `@supabase/ssr`. Content lives on the self-hosted Supabase. Deployment goes through k8s-fleet (`resumex/`).

## How access and content work

```
Supabase sign-in ──▶ resume_users (user_id, role, active)? ──no──▶ "No résumé profile"
                                    │ yes
                                    ▼
            resume_versions: duplicate ─▶ edit ─▶ preview ─▶ make live (admin)
                                                                  │
public page / ◀── the one row with is_active = true ◀─────────────┘
```

- **`resume_users`** holds one profile per Supabase account, keyed on `auth.users.id` (never the email, which users can change). The role is `admin` (manages users, picks the live version, deletes versions) or `editor` (creates and edits versions, uploads PDFs). Being signed in to Supabase alone grants nothing: the instance is shared with main-site and Native Books.
- **`resume_versions`** stores one JSON document per version, validated by `lib/schema.ts`. A partial unique index allows at most one `is_active` row. The live version is **locked**: the database refuses edits and deletes to it, so changes go through a copy.
- If Supabase is unreachable or no version is live, `/` serves the bundled `lib/seed.json`, so the page never goes blank.
- `/api/healthz` is the k8s probe. It does not touch the database.

### Enforced in the database, not just the UI

| Who | Can |
|---|---|
| anon (public) | read the live version's `document` and `activated_at` only |
| signed in, no profile (e.g. a Native Books user) | read the live version, nothing else |
| editor | read all versions, create, edit non-live ones, upload PDFs, see own profile |
| admin | everything an editor can do, plus make a version live, delete non-live versions, and add, disable or remove users via RPCs |

- `is_active` is not writable by anyone. Only `activate_resume_version()` (admin) flips it, in one transaction.
- A trigger refuses any change that would leave no active admin, whether demote, disable, remove, or deleting the auth user.
- Storage `resume` bucket: public download. Resume users can upload; admins can replace or delete.
- The auth cookie is named `resumex-auth`, so it never collides with main-site's `.nativesilicon.co.za` session cookie.
- Brute-force lockout comes from Native Books' GoTrue `password_verification_attempt` hook, which covers accounts in `core.users`. Prefer adding people who already have a Native Books login. Accounts created only for résumé access are not locked out by that hook.

## Setup (one-time)

1. **First admin's account**: use an existing Supabase account (e.g. your Native Books login), or create one in Supabase Studio → Authentication → Users.

2. **Database**: apply the migration, then the seed with that account's email, against the Supabase Postgres (as `postgres`/`supabase_admin`):

   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_resume.sql
   ```

   ```bash
   psql "$SUPABASE_DB_URL" -v admin_email=you@example.com -f supabase/seed.sql
   ```

   Both are idempotent. The seed makes that account an admin and, only if there are no versions yet, adds the CV as the first live version. Further users are added from `/admin/users`.

3. **Secrets**: Vault `apps/resumex/app` with keys `SUPABASE_URL` and `SUPABASE_ANON_KEY`. External Secrets syncs them into the pod (see k8s-fleet `resumex/`).

4. **Cloudflare tunnel**: add the public hostname `resume.nativesilicon.co.za`, pointing at the ingress controller the same way `nativesilicon.co.za` is.

## Develop

```bash
cp .env.example .env.local   # leave SUPABASE_* empty to run on the seed
pnpm install
pnpm dev
```

```bash
pnpm test && pnpm typecheck && pnpm build
```

Adding a field: add it to `lib/schema.ts` (with a `.default()` so existing documents still parse), render it in `components/resume-view.tsx`, and expose it in `components/admin/editor.tsx`.

## Deploy

Push to `main`. `.github/workflows/deploy.yml` builds on the self-hosted runner and pushes `192.168.88.199:6800/resumex:<sha>-<timestamp>`. Flux image automation in k8s-fleet then bumps `resumex/values.yaml` and rolls the Deployment. **Content edits do not need a deploy.**

The workflow uses `runs-on: self-hosted`. That runner has to be registered for this repository (or its owner), and have Docker and push access to the registry.
