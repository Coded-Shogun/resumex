# resumex

Thendo Siminya's online résumé, served at **https://resume.nativesilicon.co.za**, with a `/admin` side for editing it without rebuilding or redeploying.

- **Public page (`/`)**: renders the *published* résumé from Supabase on every request. It has a "Download CV" button (an uploaded PDF) and "Print / Save PDF" (A4 print stylesheet). Light and dark themes use the Native Silicon design tokens from `main-site`.
- **Admin (`/admin`)**: sign in with Supabase Auth, edit every section, upload the PDF, **Save draft**, **Preview** the draft, then **Publish**. The change is live on the next page load.

Stack: Next.js 16 (App Router, standalone output), React 19, Tailwind v4, TypeScript, zod, `@supabase/ssr`. Content lives on the self-hosted Supabase. Deployment goes through k8s-fleet (`resumex/`).

## How content flows

```
/admin editor ──save──▶ resume_content.draft ──publish──▶ resume_content.published ──▶ /
       │                   (RPC, admin only)               (RPC, admin only)          (anon read, published column only)
       └──upload PDF──▶ storage bucket "resume" (public read, admin write)
```

- One JSON document, validated by `lib/schema.ts` on save and on read.
- If Supabase is unreachable or not configured, `/` serves the bundled `lib/seed.json`, so the page never goes blank.
- `/api/healthz` is the k8s probe. It does not touch the database.

### Security model

The Supabase instance is shared with main-site and other apps, so being `authenticated` grants nothing on its own:

- `anon` and `authenticated` can read only `id, published, published_at` (column grant). The draft is never exposed through PostgREST.
- Draft read, save and publish are `security definer` RPCs that check `resume_admins` for the JWT email.
- The app also requires the email to be in `ADMIN_EMAILS`. Both gates must pass.
- Storage `resume` bucket: public download, and only admins can list, upload, replace or delete.
- The auth cookie is named `resumex-auth`, so it never collides with main-site's `.nativesilicon.co.za` session cookie.

## Setup (one-time)

1. **Database**: apply the migration, then the seed, against the Supabase Postgres (as `postgres`/`supabase_admin`):

   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_resume.sql
   ```

   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/seed.sql
   ```

   Both are idempotent. The seed only inserts when the row doesn't exist, so it never overwrites admin edits. To change the admin email, edit `scripts/gen-seed.mjs`, run `pnpm seed:sql`, or insert into `resume_admins` directly (lower-case).

2. **Admin user**: in Supabase Studio → Authentication → Users → *Add user*, create the admin email with a password (tick *Auto confirm*).

3. **Secrets**: Vault `apps/resumex/app` with keys `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_EMAILS`. External Secrets syncs them into the pod (see k8s-fleet `resumex/`).

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
