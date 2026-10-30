-- resumex: résumé users, versioned résumé documents, PDF bucket.
--
-- Runs against the shared self-hosted Supabase (supabase.nativesilicon.co.za),
-- so everything is prefixed resume_ and lives in public (no extra PostgREST
-- schema to expose). Other apps' users are also "authenticated" on this
-- instance, so being signed in grants nothing here: access comes from a row
-- in resume_users, keyed on the auth user id (never the email, which a user
-- can change).
--
--   resume_users     who may use /admin, and as what (admin | editor)
--   resume_versions  any number of named versions; exactly one is_active,
--                    which is what the public page shows. The active version
--                    is locked: duplicate it to change it, then activate.
--
-- Idempotent: safe to re-run.

begin;

-- ── Users ────────────────────────────────────────────────────────────────────
create table if not exists public.resume_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role         text not null default 'editor' check (role in ('admin', 'editor')),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid
);
alter table public.resume_users enable row level security;

create or replace function public.is_resume_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.resume_users
    where user_id = auth.uid() and active
  );
$$;

create or replace function public.is_resume_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.resume_users
    where user_id = auth.uid() and active and role = 'admin'
  );
$$;

-- A user sees their own profile; admins see everyone. All changes go through
-- the admin RPCs below.
revoke all on public.resume_users from anon, authenticated;
grant select on public.resume_users to authenticated;
drop policy if exists "resume_users read" on public.resume_users;
create policy "resume_users read" on public.resume_users
  for select to authenticated
  using (user_id = auth.uid() or public.is_resume_admin());

-- Never leave the app without an active admin (covers demote, deactivate,
-- delete, and the auth user being deleted).
create or replace function public.resume_users_keep_an_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.resume_users where role = 'admin' and active) then
    raise exception 'resumex needs at least one active admin' using errcode = '23514';
  end if;
  return null;
end;
$$;
drop trigger if exists resume_users_keep_an_admin on public.resume_users;
create trigger resume_users_keep_an_admin
  after update or delete on public.resume_users
  for each statement execute function public.resume_users_keep_an_admin();

create or replace function public.list_resume_users()
returns table (
  user_id uuid, email text, display_name text, role text, active boolean,
  created_at timestamptz, last_sign_in_at timestamptz
)
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
    select ru.user_id, au.email::text, ru.display_name, ru.role, ru.active,
           ru.created_at, au.last_sign_in_at
    from public.resume_users ru
    join auth.users au on au.id = ru.user_id
    order by ru.created_at;
end;
$$;

-- Adds or updates a profile for an existing Supabase account, found by email.
create or replace function public.upsert_resume_user(p_email text, p_role text, p_display_name text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_resume_admin() then
    raise exception 'not a resume admin' using errcode = '42501';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_id is null then
    raise exception 'no Supabase account for %; create the user in Supabase first', trim(p_email)
      using errcode = 'P0002';
  end if;
  insert into public.resume_users (user_id, display_name, role, created_by)
  values (v_id, coalesce(trim(p_display_name), ''), p_role, auth.uid())
  on conflict (user_id) do update
    set role = excluded.role,
        display_name = case when excluded.display_name = '' then resume_users.display_name
                            else excluded.display_name end;
  return v_id;
end;
$$;

create or replace function public.set_resume_user_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_resume_admin() then
    raise exception 'not a resume admin' using errcode = '42501';
  end if;
  update public.resume_users set active = p_active where user_id = p_user_id;
end;
$$;

create or replace function public.remove_resume_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_resume_admin() then
    raise exception 'not a resume admin' using errcode = '42501';
  end if;
  delete from public.resume_users where user_id = p_user_id;
end;
$$;

-- ── Versions ─────────────────────────────────────────────────────────────────
create table if not exists public.resume_versions (
  id           uuid primary key default gen_random_uuid(),
  label        text not null check (length(trim(label)) between 1 and 120),
  document     jsonb not null check (jsonb_typeof(document) = 'object'),
  is_active    boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  activated_at timestamptz,
  activated_by uuid
);
create unique index if not exists resume_versions_one_active
  on public.resume_versions (is_active) where is_active;
alter table public.resume_versions enable row level security;

create or replace function public.resume_versions_stamp()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists resume_versions_stamp on public.resume_versions;
create trigger resume_versions_stamp
  before insert or update of label, document on public.resume_versions
  for each row execute function public.resume_versions_stamp();

-- The public (and other apps' users) can read the active version only; anon
-- gets just the columns the page renders. Resume users see every version.
revoke all on public.resume_versions from anon, authenticated;
grant select (id, document, activated_at, is_active) on public.resume_versions to anon;
grant select on public.resume_versions to authenticated;
-- is_active is deliberately not writable: only activate_resume_version() sets it.
grant insert (label, document), update (label, document), delete on public.resume_versions to authenticated;

-- Separate policies per role: anon cannot execute is_resume_user(), and a
-- shared policy calling it would fail every anonymous read.
drop policy if exists "resume_versions public read" on public.resume_versions;
create policy "resume_versions public read" on public.resume_versions
  for select to anon
  using (is_active);

drop policy if exists "resume_versions member read" on public.resume_versions;
create policy "resume_versions member read" on public.resume_versions
  for select to authenticated
  using (is_active or public.is_resume_user());

drop policy if exists "resume_versions insert" on public.resume_versions;
create policy "resume_versions insert" on public.resume_versions
  for insert to authenticated
  with check (public.is_resume_user());

drop policy if exists "resume_versions update" on public.resume_versions;
create policy "resume_versions update" on public.resume_versions
  for update to authenticated
  using (public.is_resume_user() and not is_active)
  with check (public.is_resume_user());

drop policy if exists "resume_versions delete" on public.resume_versions;
create policy "resume_versions delete" on public.resume_versions
  for delete to authenticated
  using (public.is_resume_admin() and not is_active);

create or replace function public.activate_resume_version(p_id uuid)
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
  if not exists (select 1 from public.resume_versions where id = p_id) then
    raise exception 'no such version' using errcode = 'P0002';
  end if;
  update public.resume_versions set is_active = false where is_active and id <> p_id;
  update public.resume_versions
    set is_active = true, activated_at = ts, activated_by = auth.uid()
    where id = p_id;
  return ts;
end;
$$;

-- ── Function privileges ──────────────────────────────────────────────────────
revoke execute on function public.is_resume_user()                       from public, anon;
revoke execute on function public.is_resume_admin()                      from public, anon;
revoke execute on function public.list_resume_users()                    from public, anon;
revoke execute on function public.upsert_resume_user(text, text, text)   from public, anon;
revoke execute on function public.set_resume_user_active(uuid, boolean)  from public, anon;
revoke execute on function public.remove_resume_user(uuid)               from public, anon;
revoke execute on function public.activate_resume_version(uuid)          from public, anon;
revoke execute on function public.resume_users_keep_an_admin()           from public, anon, authenticated;
grant  execute on function public.is_resume_user()                       to authenticated;
grant  execute on function public.is_resume_admin()                      to authenticated;
grant  execute on function public.list_resume_users()                    to authenticated;
grant  execute on function public.upsert_resume_user(text, text, text)   to authenticated;
grant  execute on function public.set_resume_user_active(uuid, boolean)  to authenticated;
grant  execute on function public.remove_resume_user(uuid)               to authenticated;
grant  execute on function public.activate_resume_version(uuid)          to authenticated;

-- ── PDF bucket ───────────────────────────────────────────────────────────────
-- Public bucket: downloads go through the public URL, which skips RLS. The
-- policies below cover the API: resume users can list and upload (storage-api
-- reads the row back after insert, hence the select one); admins can replace
-- or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resume', 'resume', true, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = true, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

-- Policy names used by earlier drafts of this migration.
drop policy if exists "resume bucket admin select" on storage.objects;
drop policy if exists "resume bucket admin insert" on storage.objects;

drop policy if exists "resume bucket user select" on storage.objects;
create policy "resume bucket user select" on storage.objects
  for select to authenticated
  using (bucket_id = 'resume' and public.is_resume_user());

drop policy if exists "resume bucket user insert" on storage.objects;
create policy "resume bucket user insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resume' and public.is_resume_user());

drop policy if exists "resume bucket admin update" on storage.objects;
create policy "resume bucket admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'resume' and public.is_resume_admin());

drop policy if exists "resume bucket admin delete" on storage.objects;
create policy "resume bucket admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resume' and public.is_resume_admin());

commit;
