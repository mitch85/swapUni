-- SwapUni – initial schema
-- All tables use Row Level Security: users can only read what they are allowed to see.
-- Supabase encrypts the database and storage at rest (AES-256) and all traffic uses TLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Universities and their swap rules.
-- Editable in the Supabase dashboard (Table Editor) – changes reach the app on next launch.
-- ---------------------------------------------------------------------------
create table public.universities (
  id text primary key,
  name text not null,
  city text not null,
  swap_possible boolean not null default true,
  ring_swap text not null default 'unknown' check (ring_swap in ('yes', 'no', 'unknown')),
  ring_swap_max int,
  min_semester int,          -- 0 = vor Studienbeginn, null = unbekannt
  max_semester int,
  model_program boolean not null default false,
  swap_with_model boolean not null default true,
  swap_with_regular boolean not null default true,
  regular_swap_min_semester int,
  requires_exact_semester boolean not null default false,
  requires_dean_approval boolean not null default false,
  excludes_lawsuit_places boolean not null default false,
  partner_must_apply_online boolean not null default false,
  deadline_sose text,
  deadline_wise text,
  forms jsonb not null default '[]'::jsonb,   -- [{ "label": "...", "url": "..." }]
  contact_email text,
  contact_phone text,
  website text,
  notes text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.universities enable row level security;
create policy "Universities are public" on public.universities for select using (true);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_.-]{3,24}$'),
  first_name text not null default '',
  last_name text not null default '',
  verification_status text not null default 'none'
    check (verification_status in ('none', 'pending', 'verified', 'rejected')),
  verification_path text,
  push_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index profiles_username_lower on public.profiles (lower(username));

alter table public.profiles enable row level security;
create policy "Read own profile" on public.profiles for select using (id = auth.uid());
create policy "Update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Users may only request verification; verifying is done by an admin in the dashboard.
create function public.guard_verification() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null
     and new.verification_status is distinct from old.verification_status
     and new.verification_status not in ('none', 'pending') then
    raise exception 'verification status can only be set by an administrator';
  end if;
  return new;
end $$;

create trigger profiles_guard_verification before update on public.profiles
  for each row execute function public.guard_verification();

-- Create a profile for every new auth user (data comes from signUp options.data).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only first name, initial of the last name and verification are visible to other users.
create view public.public_profiles as
  select id, username, first_name, left(last_name, 1) as last_initial,
         verification_status = 'verified' as verified
  from public.profiles;

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

create function public.username_available(name text) returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Swap requests (Tauschgesuche) – one per user.
-- ---------------------------------------------------------------------------
create table public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade default auth.uid(),
  program text not null check (program in ('humanmedizin', 'zahnmedizin')),
  current_university_id text not null references public.universities (id),
  target_university_ids text[] not null
    check (cardinality(target_university_ids) between 1 and 3),
  semester int not null check (semester between 0 and 14),
  place_type text not null default 'full' check (place_type in ('full', 'partial')),
  lawsuit_place boolean not null default false,
  admission_confirmed boolean not null default true,
  desired_term text not null,
  ring_swap boolean not null default false,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (current_university_id = any (target_university_ids)))
);

create index swap_requests_active on public.swap_requests (program, desired_term) where status = 'active';

alter table public.swap_requests enable row level security;
create policy "Read active or own requests" on public.swap_requests for select
  to authenticated using (status = 'active' or user_id = auth.uid());
create policy "Insert own request" on public.swap_requests for insert
  to authenticated with check (user_id = auth.uid());
create policy "Update own request" on public.swap_requests for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Delete own request" on public.swap_requests for delete
  to authenticated using (user_id = auth.uid());

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger swap_requests_touch before update on public.swap_requests
  for each row execute function public.touch_updated_at();

-- All active offers with the public part of the owner's profile.
create view public.offers with (security_invoker = true) as
  select r.*, p.username, p.first_name, p.last_initial, p.verified
  from public.swap_requests r
  join public.public_profiles p on p.id = r.user_id
  where r.status = 'active';

grant select on public.offers to authenticated;

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  request_id uuid not null references public.swap_requests (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table public.favorites enable row level security;
create policy "Own favorites" on public.favorites for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_ids uuid[] not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index conversations_participants on public.conversations using gin (participant_ids);

alter table public.conversations enable row level security;
create policy "Members read conversations" on public.conversations for select
  to authenticated using (auth.uid() = any (participant_ids));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (length(body) between 1 and 4000),
  read_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index messages_conversation on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

create function public.is_member(conversation uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conversation and auth.uid() = any (c.participant_ids)
  );
$$;

create policy "Members read messages" on public.messages for select
  to authenticated using (public.is_member(conversation_id));
create policy "Members send messages" on public.messages for insert
  to authenticated with check (sender_id = auth.uid() and public.is_member(conversation_id));

create function public.bump_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;

create trigger messages_bump after insert on public.messages
  for each row execute function public.bump_conversation();

-- Returns the existing conversation between exactly these users or creates one.
create function public.start_conversation(other_ids uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  members uuid[];
  conversation uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select array_agg(distinct m order by m) into members
  from unnest(array_append(other_ids, auth.uid())) m;
  if cardinality(members) < 2 then
    raise exception 'a conversation needs at least two participants';
  end if;
  select id into conversation from public.conversations
  where participant_ids @> members and participant_ids <@ members
  limit 1;
  if conversation is null then
    insert into public.conversations (participant_ids) values (members) returning id into conversation;
  end if;
  return conversation;
end $$;

create function public.mark_conversation_read(conversation uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_by = array_append(read_by, auth.uid())
  where conversation_id = conversation
    and public.is_member(conversation)
    and not (auth.uid() = any (read_by))
    and sender_id <> auth.uid();
$$;

-- Realtime for live chat.
alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Push tokens
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  platform text,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;
create policy "Own push tokens" on public.push_tokens for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reports (Profil melden) – readable only by admins in the dashboard.
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (length(reason) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;
create policy "Create reports" on public.reports for insert
  to authenticated with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Successful swaps: the requests leave the pool, only anonymous statistics remain.
-- ---------------------------------------------------------------------------
create table public.successful_swaps (
  id uuid primary key default gen_random_uuid(),
  program text not null,
  university_ids text[] not null,
  desired_term text not null,
  created_at timestamptz not null default now()
);

alter table public.successful_swaps enable row level security;

create function public.complete_swap(new_university_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  request public.swap_requests;
begin
  select * into request from public.swap_requests where user_id = auth.uid();
  if not found then
    raise exception 'no swap request';
  end if;
  insert into public.successful_swaps (program, university_ids, desired_term)
  values (request.program, array[request.current_university_id, new_university_id], request.desired_term);
  delete from public.favorites where request_id = request.id;
  update public.swap_requests set status = 'completed', completed_at = now() where id = request.id;
end $$;

create function public.successful_swap_count() returns bigint
language sql security definer set search_path = public stable as $$
  select count(*) from public.successful_swaps;
$$;

grant execute on function public.successful_swap_count() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion (DSGVO): removes the auth user and – via cascades – all data.
-- ---------------------------------------------------------------------------
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth, storage as $$
begin
  delete from storage.objects where bucket_id = 'verifications' and owner = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Matching helper used by the push notification function: users whose active request is
-- a direct counterpart of the given request.
-- ---------------------------------------------------------------------------
create function public.direct_counterparts(request_id uuid) returns setof uuid
language sql security definer set search_path = public stable as $$
  select o.user_id
  from public.swap_requests r
  join public.swap_requests o
    on o.status = 'active'
   and o.user_id <> r.user_id
   and o.program = r.program
   and o.desired_term = r.desired_term
   and o.current_university_id = any (r.target_university_ids)
   and r.current_university_id = any (o.target_university_ids)
  where r.id = request_id;
$$;

revoke execute on function public.direct_counterparts(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for Studienbescheinigungen / Zulassungsbescheide.
-- Files live in "<user id>/<file name>" and are only visible to their owner.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verifications', 'verifications', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do nothing;

create policy "Upload own verification" on storage.objects for insert to authenticated
  with check (bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Read own verification" on storage.objects for select to authenticated
  using (bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Delete own verification" on storage.objects for delete to authenticated
  using (bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text);
