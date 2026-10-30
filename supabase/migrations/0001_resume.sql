-- resumex: résumé content + admin allowlist + PDF bucket.
--
-- Runs against the shared self-hosted Supabase (supabase.nativesilicon.co.za),
-- so everything is prefixed resume_ and lives in public (no extra PostgREST
-- schema to expose). Other apps' users are also "authenticated" on this
-- instance, so nothing here trusts that role on its own: every write and
-- every draft read goes through a security-definer function that checks
-- resume_admins.
--
-- Idempotent: safe to re-run.

begin;

-- ── Admin allowlist ──────────────────────────────────────────────────────────
create table if not exists public.resume_admins (
  email text primary key check (email = lower(email))
);
alter table public.resume_admins enable row level security;
revoke all on public.resume_admins from anon, authenticated;

create or replace function public.is_resume_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.resume_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ── Content ──────────────────────────────────────────────────────────────────
-- One row ('main'). draft is what /admin edits; published is what the public
-- page renders. Publishing copies draft -> published.
create table if not exists public.resume_content (
  id               text primary key default 'main',
  draft            jsonb not null,
  published        jsonb not null,
  draft_updated_at timestamptz not null default now(),
  published_at     timestamptz not null default now(),
  updated_by       text
);
alter table public.resume_content enable row level security;

-- Column-level grant: the public (and other apps' users) can read the
-- published document only, never the draft.
revoke all on public.resume_content from anon, authenticated;
grant select (id, published, published_at) on public.resume_content to anon, authenticated;

drop policy if exists "resume_content public read" on public.resume_content;
create policy "resume_content public read" on public.resume_content
  for select to anon, authenticated using (true);

-- ── Admin RPCs ───────────────────────────────────────────────────────────────
create or replace function public.get_resume_draft()
returns table (draft jsonb, draft_updated_at timestamptz, published_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_resume_admin() then
    raise exception 'not a resume admin' using errcode = '42501';
  end if;
  return query
    select c.draft, c.draft_updated_at, c.published_at
    from public.resume_content c where c.id = 'main';
end;
$$;

create or replace function public.save_resume_draft(doc jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ts timestamptz := now();
begin
  if not public.is_resume_admin() then
    raise exception 'not a resume admin' using errcode = '42501';
  end if;
  insert into public.resume_content (id, draft, published, draft_updated_at, updated_by)
  values ('main', doc, doc, ts, auth.jwt() ->> 'email')
  on conflict (id) do update
    set draft = excluded.draft,
        draft_updated_at = ts,
        updated_by = excluded.updated_by;
  return ts;
end;
$$;

create or replace function public.publish_resume()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ts timestamptz := now();
begin
  if not public.is_resume_admin() then
    raise exception 'not a resume admin' using errcode = '42501';
  end if;
  update public.resume_content
    set published = draft, published_at = ts, updated_by = auth.jwt() ->> 'email'
    where id = 'main';
  return ts;
end;
$$;

revoke execute on function public.is_resume_admin()       from public, anon;
revoke execute on function public.get_resume_draft()      from public, anon;
revoke execute on function public.save_resume_draft(jsonb) from public, anon;
revoke execute on function public.publish_resume()        from public, anon;
grant  execute on function public.is_resume_admin()       to authenticated;
grant  execute on function public.get_resume_draft()      to authenticated;
grant  execute on function public.save_resume_draft(jsonb) to authenticated;
grant  execute on function public.publish_resume()        to authenticated;

-- ── PDF bucket ───────────────────────────────────────────────────────────────
-- Public bucket: downloads go through the public URL, which skips RLS. The
-- policies below cover the API: only admins can list, upload, replace or
-- delete (storage-api reads the row back after insert, hence the select one).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resume', 'resume', true, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = true, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

drop policy if exists "resume bucket admin select" on storage.objects;
create policy "resume bucket admin select" on storage.objects
  for select to authenticated
  using (bucket_id = 'resume' and public.is_resume_admin());

drop policy if exists "resume bucket admin insert" on storage.objects;
create policy "resume bucket admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resume' and public.is_resume_admin());

drop policy if exists "resume bucket admin update" on storage.objects;
create policy "resume bucket admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'resume' and public.is_resume_admin());

drop policy if exists "resume bucket admin delete" on storage.objects;
create policy "resume bucket admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resume' and public.is_resume_admin());

commit;
