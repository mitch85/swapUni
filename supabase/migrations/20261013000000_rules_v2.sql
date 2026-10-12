-- Rules from the October 2026 review: swaps limited to one term kind (Dresden),
-- swaps ending at a certain term (Hamburg), required academic progress, provisional
-- enrollment, and user reports about outdated university data.

alter table public.universities
  add column allowed_terms text not null default 'both' check (allowed_terms in ('both', 'WiSe', 'SoSe')),
  add column last_swap_term text,
  add column achievement_note text;

alter table public.swap_requests
  add column provisional_enrollment boolean not null default false;

-- r.* in the view is expanded at creation time, so the view is rebuilt for the new column.
drop view public.offers;
create view public.offers with (security_invoker = true) as
  select r.*, p.username, p.first_name, p.last_initial, p.verified
  from public.swap_requests r
  join public.public_profiles p on p.id = r.user_id
  where r.status = 'active';

grant select on public.offers to authenticated;

create table public.university_reports (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null default auth.uid(),
  message text not null check (length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.university_reports enable row level security;
create policy "Report university data" on public.university_reports for insert
  to authenticated with check (reporter_id = auth.uid());
