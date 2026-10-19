-- Changes from the client's answers to the requirements questionnaire (October 2026).

-- ---------------------------------------------------------------------------
-- University list: Dortmund has no medical faculty (answer 4.4).
-- ---------------------------------------------------------------------------
delete from public.universities u
where u.id = 'dortmund'
  and not exists (
    select 1 from public.swap_requests r
    where r.current_university_id = u.id or u.id = any (r.target_university_ids)
  );

-- ---------------------------------------------------------------------------
-- Swap requests
-- ---------------------------------------------------------------------------
-- The app currently allows 3 wishes; the database allows up to 10 so the limit can be
-- raised later with an app update only (answer 3.3).
alter table public.swap_requests drop constraint swap_requests_target_university_ids_check;
alter table public.swap_requests
  add constraint swap_requests_target_university_ids_check
  check (cardinality(target_university_ids) between 1 and 10);

-- Physikum passed – needed for swaps into the clinical part (answer 3.2).
alter table public.swap_requests add column physikum_passed boolean not null default false;

-- ---------------------------------------------------------------------------
-- Profiles: blocking (answer 5.5) and inactivity tracking (answer 3.9)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column blocked_at timestamptz,
  add column last_active_at timestamptz not null default now(),
  add column inactivity_reminder_at timestamptz;

-- Users may request verification, but only admins verify or block.
create or replace function public.guard_verification() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    if new.verification_status is distinct from old.verification_status
       and new.verification_status not in ('none', 'pending') then
      raise exception 'verification status can only be set by an administrator';
    end if;
    if new.blocked_at is distinct from old.blocked_at then
      raise exception 'blocking can only be changed by an administrator';
    end if;
  end if;
  return new;
end $$;

create function public.is_blocked() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and blocked_at is not null);
$$;

create function public.touch_activity() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_active_at = now() where id = auth.uid();
$$;

-- Blocked users can neither publish requests nor write messages.
drop policy "Insert own request" on public.swap_requests;
drop policy "Update own request" on public.swap_requests;
create policy "Insert own request" on public.swap_requests for insert
  to authenticated with check (user_id = auth.uid() and not public.is_blocked());
create policy "Update own request" on public.swap_requests for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and not public.is_blocked());

drop policy "Members send messages" on public.messages;
create policy "Members send messages" on public.messages for insert
  to authenticated with check (sender_id = auth.uid() and public.is_member(conversation_id) and not public.is_blocked());

-- ---------------------------------------------------------------------------
-- Public profile: verification state visible to others (answer 5.1), blocked users hidden.
-- ---------------------------------------------------------------------------
drop view public.offers;
drop view public.public_profiles;

create view public.public_profiles as
  select id, username, first_name, left(last_name, 1) as last_initial,
         verification_status = 'verified' as verified,
         verification_status,
         blocked_at is not null as blocked
  from public.profiles;

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

create view public.offers with (security_invoker = true) as
  select r.*, p.username, p.first_name, p.last_initial, p.verified, p.verification_status
  from public.swap_requests r
  join public.public_profiles p on p.id = r.user_id
  where r.status = 'active' and not p.blocked;

grant select on public.offers to authenticated;

-- ---------------------------------------------------------------------------
-- Swap checklist per conversation (answer 3.5): { "<user id>": ["forms", ...] }
-- ---------------------------------------------------------------------------
alter table public.conversations add column checklist jsonb not null default '{}'::jsonb;

create function public.set_checklist_item(conversation uuid, item text, done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  current_items jsonb;
  next_items jsonb;
begin
  if not public.is_member(conversation) then
    raise exception 'not a member of this conversation';
  end if;
  if item not in ('forms', 'signed', 'submitted', 'approved', 'enrolled') then
    raise exception 'unknown checklist item %', item;
  end if;
  select coalesce(checklist -> auth.uid()::text, '[]'::jsonb) into current_items
  from public.conversations where id = conversation;
  select coalesce(jsonb_agg(distinct value), '[]'::jsonb) into next_items
  from (
    select value from jsonb_array_elements_text(current_items) value where value <> item
    union all
    select item where done
  ) items;
  update public.conversations
  set checklist = jsonb_set(checklist, array[auth.uid()::text], next_items, true)
  where id = conversation;
end $$;

-- ---------------------------------------------------------------------------
-- Daily maintenance (called by the `maintenance` edge function):
--   * pause requests of users inactive for a year (answer 3.9)
--   * delete completed requests six weeks after a successful swap (answer 6.5)
--   * return users to remind two weeks before their request is paused
-- ---------------------------------------------------------------------------
create function public.run_maintenance() returns table (user_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  update public.swap_requests r set status = 'paused'
  from public.profiles p
  where p.id = r.user_id and r.status = 'active' and p.last_active_at < now() - interval '365 days';

  delete from public.swap_requests
  where status = 'completed' and completed_at < now() - interval '42 days';

  return query
  update public.profiles p set inactivity_reminder_at = now()
  where p.last_active_at < now() - interval '351 days'
    and (p.inactivity_reminder_at is null or p.inactivity_reminder_at < p.last_active_at)
    and exists (select 1 from public.swap_requests r where r.user_id = p.id and r.status = 'active')
  returning p.id;
end $$;

revoke execute on function public.run_maintenance() from public, anon, authenticated;

-- Account deletion now runs in the `delete-account` edge function, because stored files
-- must be removed through the Storage API.
drop function public.delete_my_account();

-- ---------------------------------------------------------------------------
-- Anonymous usage statistics for the operator (answer 8.5). Not exposed to the app.
-- ---------------------------------------------------------------------------
create view public.admin_stats as
  select
    (select count(*) from public.profiles) as registered_users,
    (select count(*) from public.profiles where created_at > now() - interval '7 days') as new_users_7_days,
    (select count(*) from public.swap_requests where status = 'active') as active_requests,
    (select count(*) from public.swap_requests where status = 'paused') as paused_requests,
    (select count(*) from public.successful_swaps) as successful_swaps,
    (select count(*) from public.conversations) as conversations,
    (select count(*) from public.profiles where verification_status = 'pending') as verifications_to_review,
    (select count(*) from public.reports) as user_reports,
    (select count(*) from public.university_reports) as university_reports;

revoke all on public.admin_stats from public, anon, authenticated;
