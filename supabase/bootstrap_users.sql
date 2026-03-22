-- Run this in Supabase SQL Editor for project: runclubsnearme
-- Purpose: create the app profile table expected by auth flow.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text not null default 'Runner',
  role text not null default 'runner' check (role in ('runner', 'club_owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

do $$
begin
  -- Users can read their own profile.
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_select_own'
  ) then
    create policy "users_select_own"
    on public.users
    for select
    to authenticated
    using (auth.uid() = id);
  end if;

  -- Users can insert their own profile row.
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_insert_own'
  ) then
    create policy "users_insert_own"
    on public.users
    for insert
    to authenticated
    with check (auth.uid() = id);
  end if;

  -- Users can update their own profile row.
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_update_own'
  ) then
    create policy "users_update_own"
    on public.users
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);
  end if;

  -- Admin can read and update any profile row.
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_select_admin'
  ) then
    create policy "users_select_admin"
    on public.users
    for select
    to authenticated
    using ((auth.jwt() ->> 'email') = 'a.samad4651@gmail.com');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_update_admin'
  ) then
    create policy "users_update_admin"
    on public.users
    for update
    to authenticated
    using ((auth.jwt() ->> 'email') = 'a.samad4651@gmail.com')
    with check ((auth.jwt() ->> 'email') = 'a.samad4651@gmail.com');
  end if;

end $$;

-- Core tables for directory ownership, run settings, and event participation.
create extension if not exists pgcrypto;

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null references auth.users(id) on delete set null,
  name text not null unique,
  description text,
  location text,
  schedule_day text,
  schedule_time text,
  lat double precision,
  lng double precision,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clubs add column if not exists schedule_day text;
alter table public.clubs add column if not exists schedule_time text;
alter table public.clubs add column if not exists lat double precision;
alter table public.clubs add column if not exists lng double precision;

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  date date not null,
  time text not null,
  is_recurring_weekly boolean not null default false,
  distance text,
  pace_range text,
  location text,
  created_at timestamptz not null default now()
);

alter table public.runs add column if not exists is_recurring_weekly boolean not null default false;

create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create table if not exists public.club_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text,
  event_date date not null,
  event_time text not null,
  location text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.club_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.club_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.club_owner_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  phone text,
  experience_level text,
  preferred_run_days text,
  preferred_run_time text,
  proposed_location text,
  instagram_handle text,
  website_url text,
  notes text,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (user_id, club_id)
);

alter table public.clubs enable row level security;
alter table public.runs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_events enable row level security;
alter table public.club_event_participants enable row level security;
alter table public.club_owner_applications enable row level security;

do $$
begin
  -- Clubs are visible to everyone (map/discovery), editable by owner.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clubs' and policyname = 'clubs_select_all'
  ) then
    create policy "clubs_select_all"
    on public.clubs
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clubs' and policyname = 'clubs_insert_owner'
  ) then
    create policy "clubs_insert_owner"
    on public.clubs
    for insert
    to authenticated
    with check (owner_id is null or owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clubs' and policyname = 'clubs_update_owner'
  ) then
    create policy "clubs_update_owner"
    on public.clubs
    for update
    to authenticated
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clubs' and policyname = 'clubs_update_admin'
  ) then
    create policy "clubs_update_admin"
    on public.clubs
    for update
    to authenticated
    using ((auth.jwt() ->> 'email') = 'a.samad4651@gmail.com')
    with check ((auth.jwt() ->> 'email') = 'a.samad4651@gmail.com');
  end if;

  -- Runs are public to read, writable by owning club owner.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'runs' and policyname = 'runs_select_all'
  ) then
    create policy "runs_select_all"
    on public.runs
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'runs' and policyname = 'runs_write_owner'
  ) then
    create policy "runs_write_owner"
    on public.runs
    for all
    to authenticated
    using (
      exists (
        select 1 from public.clubs c
        where c.id = runs.club_id and c.owner_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1 from public.clubs c
        where c.id = runs.club_id and c.owner_id = auth.uid()
      )
    );
  end if;

  -- Runners manage their own memberships.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_members' and policyname = 'club_members_select_own'
  ) then
    create policy "club_members_select_own"
    on public.club_members
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_members' and policyname = 'club_members_select_owner'
  ) then
    create policy "club_members_select_owner"
    on public.club_members
    for select
    to authenticated
    using (
      exists (
        select 1 from public.clubs c
        where c.id = club_members.club_id and c.owner_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_members' and policyname = 'club_members_insert_own'
  ) then
    create policy "club_members_insert_own"
    on public.club_members
    for insert
    to authenticated
    with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_members' and policyname = 'club_members_delete_own'
  ) then
    create policy "club_members_delete_own"
    on public.club_members
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_select_club_owner_members'
  ) then
    create policy "users_select_club_owner_members"
    on public.users
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.club_members cm
        join public.clubs c on c.id = cm.club_id
        where cm.user_id = users.id
          and c.owner_id = auth.uid()
      )
    );
  end if;

  -- Events are public to read, writable by owning club owner.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_events' and policyname = 'club_events_select_all'
  ) then
    create policy "club_events_select_all"
    on public.club_events
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_events' and policyname = 'club_events_write_owner'
  ) then
    create policy "club_events_write_owner"
    on public.club_events
    for all
    to authenticated
    using (
      exists (
        select 1 from public.clubs c
        where c.id = club_events.club_id and c.owner_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1 from public.clubs c
        where c.id = club_events.club_id and c.owner_id = auth.uid()
      )
    );
  end if;

  -- Event participants can join/leave their own records.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_event_participants' and policyname = 'club_event_participants_select_all'
  ) then
    create policy "club_event_participants_select_all"
    on public.club_event_participants
    for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_event_participants' and policyname = 'club_event_participants_insert_own'
  ) then
    create policy "club_event_participants_insert_own"
    on public.club_event_participants
    for insert
    to authenticated
    with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_event_participants' and policyname = 'club_event_participants_delete_own'
  ) then
    create policy "club_event_participants_delete_own"
    on public.club_event_participants
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  -- Club owner applications are created/read by applicant. Admin review is done via service role.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_owner_applications' and policyname = 'club_owner_applications_select_own'
  ) then
    create policy "club_owner_applications_select_own"
    on public.club_owner_applications
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_owner_applications' and policyname = 'club_owner_applications_insert_own'
  ) then
    create policy "club_owner_applications_insert_own"
    on public.club_owner_applications
    for insert
    to authenticated
    with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_owner_applications' and policyname = 'club_owner_applications_select_admin'
  ) then
    create policy "club_owner_applications_select_admin"
    on public.club_owner_applications
    for select
    to authenticated
    using ((auth.jwt() ->> 'email') = 'a.samad4651@gmail.com');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'club_owner_applications' and policyname = 'club_owner_applications_update_admin'
  ) then
    create policy "club_owner_applications_update_admin"
    on public.club_owner_applications
    for update
    to authenticated
    using ((auth.jwt() ->> 'email') = 'a.samad4651@gmail.com')
    with check ((auth.jwt() ->> 'email') = 'a.samad4651@gmail.com');
  end if;
end $$;

-- Seed starter clubs with null owner_id so admins can assign later.
insert into public.clubs (name, description, location, schedule_day, schedule_time, lat, lng, owner_id)
values
  ('440 Run Club (Bronte)', 'Directory seeded club listing', 'Bronte', 'Saturdays', '5:00 AM', -33.9256, 151.2768, null),
  ('Sydney Striders', 'Directory seeded club listing', 'Centennial Park', 'Tue, Thu', '6:00 PM', -33.8983, 151.2334, null),
  ('The Run Club (CBD)', 'Directory seeded club listing', 'Domain', 'Tue, Thu', '6:30 AM', -33.8634, 151.2153, null),
  ('AM:PM.RC', 'Directory seeded club listing', 'Surry Hills', 'Tuesdays', '6:00 PM', -33.8887, 151.2165, null),
  ('Parkrun (St. Peters)', 'Directory seeded club listing', 'St Peters', 'Saturdays', '8:00 AM', -33.9065, 151.1622, null),
  ('Night Terrors Run Crew', 'Directory seeded club listing', 'Marrickville', 'Tuesdays', '7:00 PM', -33.9020, 151.1002, null),
  ('Centennial Park Run Group', 'Directory seeded club listing', 'Centennial Park', 'Sundays', '8:00 AM', -33.8983, 151.2334, null),
  ('VRC (Victory Run Club)', 'Directory seeded club listing', 'Circular Quay', 'Tuesdays', '6:00 AM', -33.8568, 151.2127, null),
  ('Early Risers (CBD)', 'Directory seeded club listing', 'Domain', 'Wednesdays', '6:15 AM', -33.8700, 151.2190, null),
  ('The Rocks Run Club', 'Directory seeded club listing', 'The Rocks', 'Mondays', '6:00 PM', -33.8629, 151.2085, null),
  ('440 Run Club (Bondi)', 'Directory seeded club listing', 'Bondi', 'Saturdays', '5:00 AM', -33.8901, 151.2752, null),
  ('Bondi Run Club', 'Directory seeded club listing', 'Bondi', 'Tue, Thu', '6:30 AM', -33.8901, 151.2752, null),
  ('Coastal Track Run Club', 'Directory seeded club listing', 'Coogee', 'Saturdays', '8:00 AM', -33.9140, 151.2525, null),
  ('Coogee Run Club', 'Directory seeded club listing', 'Coogee', 'Thursdays', '6:15 AM', -33.9220, 151.2575, null),
  ('Eastern Suburbs H3', 'Directory seeded club listing', 'Randwick', 'Mondays', '6:00 PM', -33.9155, 151.2410, null),
  ('Maroubra Run Club', 'Directory seeded club listing', 'Maroubra', 'Wednesdays', '6:00 AM', -33.9520, 151.2360, null),
  ('Run With Me (Randwick)', 'Directory seeded club listing', 'Randwick', 'Thursdays', '6:30 AM', -33.8983, 151.2334, null),
  ('The Bra Run Club', 'Directory seeded club listing', 'Maroubra', 'Fridays', '6:00 AM', -33.9490, 151.2360, null),
  ('Rose Bay Run Club', 'Directory seeded club listing', 'Rose Bay', 'Mondays', '6:30 AM', -33.8828, 151.2465, null),
  ('Tamarama Run Crew', 'Directory seeded club listing', 'Tamarama', 'Wednesdays', '6:00 AM', -33.9055, 151.2820, null),
  ('Parkrun (Wentworth Common)', 'Directory seeded club listing', 'Strathfield', 'Saturdays', '8:00 AM', -33.8460, 151.0775, null),
  ('Balmain Run Club', 'Directory seeded club listing', 'Balmain', 'Wednesdays', '6:30 PM', -33.8690, 151.1850, null),
  ('Inner West Road Runners', 'Directory seeded club listing', 'Enmore', 'Tue, Thu', '6:00 PM', -33.8865, 151.1410, null),
  ('Glebe Greyhounds (Social)', 'Directory seeded club listing', 'Glebe', 'Thursdays', '6:15 PM', -33.8760, 151.1710, null),
  ('Newtown Run Club', 'Directory seeded club listing', 'Newtown', 'Tuesdays', '7:00 PM', -33.8995, 151.1745, null),
  ('Five Dock Leisure Centre Runners', 'Directory seeded club listing', 'Five Dock', 'Mon, Wed', '6:00 AM', -33.8540, 151.0365, null),
  ('Leichhardt Run Group', 'Directory seeded club listing', 'Leichhardt', 'Saturdays', '7:30 AM', -33.8660, 151.1700, null),
  ('Rhodes Run Club', 'Directory seeded club listing', 'Rhodes', 'Tuesdays', '6:30 PM', -33.8400, 151.1065, null),
  ('Marrickville Run Crew', 'Directory seeded club listing', 'Marrickville', 'Fridays', '6:30 AM', -33.9000, 151.1008, null),
  ('Burwood Run Club', 'Directory seeded club listing', 'Burwood', 'Mondays', '6:00 PM', -33.8880, 151.1065, null),
  ('Manly Beach Running Club', 'Directory seeded club listing', 'Manly', 'Daily', '6:00 AM', -33.7974, 151.2873, null),
  ('Northside Running Group', 'Directory seeded club listing', 'St Leonards', 'Tue, Thu', '6:30 AM', -33.8190, 151.2090, null),
  ('Kirribilli Run Club', 'Directory seeded club listing', 'Kirribilli', 'Mon, Thu', '6:30 AM', -33.8425, 151.2180, null),
  ('Mosman Run Club', 'Directory seeded club listing', 'Mosman', 'Wednesdays', '6:00 AM', -33.8310, 151.2325, null),
  ('Parkrun (Mosman)', 'Directory seeded club listing', 'Mosman', 'Saturdays', '8:00 AM', -33.8080, 151.2920, null),
  ('Dee Why Run Club', 'Directory seeded club listing', 'Dee Why', 'Tuesdays', '6:00 AM', -33.7585, 151.3062, null),
  ('Freshwater Run Group', 'Directory seeded club listing', 'Freshwater', 'Fridays', '6:15 AM', -33.7810, 151.3160, null),
  ('Chatswood Run Club', 'Directory seeded club listing', 'Chatswood', 'Wednesdays', '6:30 PM', -33.7980, 151.1880, null),
  ('Lane Cove River Run', 'Directory seeded club listing', 'Lane Cove', 'Sundays', '7:30 AM', -33.8210, 151.1615, null),
  ('Narrabeen Lake Run Club', 'Directory seeded club listing', 'Narrabeen', 'Thursdays', '6:00 PM', -33.7220, 151.2865, null),
  ('Western Sydney Marathon Club', 'Directory seeded club listing', 'Penrith', 'Weekends', '7:00 AM', -33.7460, 150.7220, null),
  ('Parkrun (Parramatta)', 'Directory seeded club listing', 'Parramatta', 'Saturdays', '8:00 AM', -33.8180, 151.0085, null),
  ('Cronulla Run Club', 'Directory seeded club listing', 'Cronulla', 'Wednesdays', '6:00 AM', -34.0485, 151.1585, null),
  ('Parramatta Run Crew', 'Directory seeded club listing', 'Parramatta', 'Tuesdays', '6:30 PM', -33.8180, 151.0085, null),
  ('Sutherland Shire Cruisers', 'Directory seeded club listing', 'Sutherland', 'Saturdays', '7:00 AM', -34.0290, 151.1520, null),
  ('Hills District Run Club', 'Directory seeded club listing', 'Castle Hill', 'Thursdays', '6:30 PM', -33.7305, 150.9710, null),
  ('Liverpool Run Club', 'Directory seeded club listing', 'Liverpool', 'Wednesdays', '6:00 PM', -33.9080, 150.9210, null),
  ('Bankstown Sports Athletics', 'Directory seeded club listing', 'Bankstown', 'Weekday evenings', '6:00 PM', -33.9150, 150.9820, null),
  ('Penrith Lakes Run', 'Directory seeded club listing', 'Penrith', 'Saturdays', '7:30 AM', -33.7460, 150.7220, null),
  ('Campbelltown Joggers', 'Directory seeded club listing', 'Campbelltown', 'Sundays', '7:00 AM', -34.2665, 150.8170, null)
on conflict (name) do update
set
  description = excluded.description,
  location = excluded.location,
  schedule_day = excluded.schedule_day,
  schedule_time = excluded.schedule_time,
  lat = excluded.lat,
  lng = excluded.lng;

-- Curated per-club image URLs (stable seeded internet photos).
with curated_images(name, image_url) as (
  values
    ('440 Run Club (Bronte)', 'https://picsum.photos/seed/bronte-run-club/1600/900'),
    ('Sydney Striders', 'https://picsum.photos/seed/sydney-striders/1600/900'),
    ('The Run Club (CBD)', 'https://picsum.photos/seed/cbd-run-club/1600/900'),
    ('AM:PM.RC', 'https://picsum.photos/seed/ampm-rc/1600/900'),
    ('Parkrun (St. Peters)', 'https://picsum.photos/seed/st-peters-parkrun/1600/900'),
    ('Night Terrors Run Crew', 'https://picsum.photos/seed/night-terrors-run-crew/1600/900'),
    ('Centennial Park Run Group', 'https://picsum.photos/seed/centennial-park-run/1600/900'),
    ('VRC (Victory Run Club)', 'https://picsum.photos/seed/victory-run-club/1600/900'),
    ('Early Risers (CBD)', 'https://picsum.photos/seed/early-risers-cbd/1600/900'),
    ('The Rocks Run Club', 'https://picsum.photos/seed/the-rocks-run-club/1600/900'),
    ('440 Run Club (Bondi)', 'https://picsum.photos/seed/bondi-440-run-club/1600/900'),
    ('Bondi Run Club', 'https://picsum.photos/seed/bondi-run-club/1600/900'),
    ('Coastal Track Run Club', 'https://picsum.photos/seed/coastal-track-run-club/1600/900'),
    ('Coogee Run Club', 'https://picsum.photos/seed/coogee-run-club/1600/900'),
    ('Eastern Suburbs H3', 'https://picsum.photos/seed/eastern-suburbs-h3/1600/900'),
    ('Maroubra Run Club', 'https://picsum.photos/seed/maroubra-run-club/1600/900'),
    ('Run With Me (Randwick)', 'https://picsum.photos/seed/run-with-me-randwick/1600/900'),
    ('The Bra Run Club', 'https://picsum.photos/seed/the-bra-run-club/1600/900'),
    ('Rose Bay Run Club', 'https://picsum.photos/seed/rose-bay-run-club/1600/900'),
    ('Tamarama Run Crew', 'https://picsum.photos/seed/tamarama-run-crew/1600/900'),
    ('Parkrun (Wentworth Common)', 'https://picsum.photos/seed/wentworth-common-parkrun/1600/900'),
    ('Balmain Run Club', 'https://picsum.photos/seed/balmain-run-club/1600/900'),
    ('Inner West Road Runners', 'https://picsum.photos/seed/inner-west-road-runners/1600/900'),
    ('Glebe Greyhounds (Social)', 'https://picsum.photos/seed/glebe-greyhounds/1600/900'),
    ('Newtown Run Club', 'https://picsum.photos/seed/newtown-run-club/1600/900'),
    ('Five Dock Leisure Centre Runners', 'https://picsum.photos/seed/five-dock-runners/1600/900'),
    ('Leichhardt Run Group', 'https://picsum.photos/seed/leichhardt-run-group/1600/900'),
    ('Rhodes Run Club', 'https://picsum.photos/seed/rhodes-run-club/1600/900'),
    ('Marrickville Run Crew', 'https://picsum.photos/seed/marrickville-run-crew/1600/900'),
    ('Burwood Run Club', 'https://picsum.photos/seed/burwood-run-club/1600/900'),
    ('Manly Beach Running Club', 'https://picsum.photos/seed/manly-beach-running/1600/900'),
    ('Northside Running Group', 'https://picsum.photos/seed/northside-running-group/1600/900'),
    ('Kirribilli Run Club', 'https://picsum.photos/seed/kirribilli-run-club/1600/900'),
    ('Mosman Run Club', 'https://picsum.photos/seed/mosman-run-club/1600/900'),
    ('Parkrun (Mosman)', 'https://picsum.photos/seed/mosman-parkrun/1600/900'),
    ('Dee Why Run Club', 'https://picsum.photos/seed/dee-why-run-club/1600/900'),
    ('Freshwater Run Group', 'https://picsum.photos/seed/freshwater-run-group/1600/900'),
    ('Chatswood Run Club', 'https://picsum.photos/seed/chatswood-run-club/1600/900'),
    ('Lane Cove River Run', 'https://picsum.photos/seed/lane-cove-river-run/1600/900'),
    ('Narrabeen Lake Run Club', 'https://picsum.photos/seed/narrabeen-lake-run-club/1600/900'),
    ('Western Sydney Marathon Club', 'https://picsum.photos/seed/western-sydney-marathon-club/1600/900'),
    ('Parkrun (Parramatta)', 'https://picsum.photos/seed/parramatta-parkrun/1600/900'),
    ('Cronulla Run Club', 'https://picsum.photos/seed/cronulla-run-club/1600/900'),
    ('Parramatta Run Crew', 'https://picsum.photos/seed/parramatta-run-crew/1600/900'),
    ('Sutherland Shire Cruisers', 'https://picsum.photos/seed/sutherland-shire-cruisers/1600/900'),
    ('Hills District Run Club', 'https://picsum.photos/seed/hills-district-run-club/1600/900'),
    ('Liverpool Run Club', 'https://picsum.photos/seed/liverpool-run-club/1600/900'),
    ('Bankstown Sports Athletics', 'https://picsum.photos/seed/bankstown-sports-athletics/1600/900'),
    ('Penrith Lakes Run', 'https://picsum.photos/seed/penrith-lakes-run/1600/900'),
    ('Campbelltown Joggers', 'https://picsum.photos/seed/campbelltown-joggers/1600/900'),
    ('Admin Demo Club', 'https://picsum.photos/seed/admin-demo-club/1600/900')
)
update public.clubs c
set image_url = ci.image_url
from curated_images ci
where c.name = ci.name
  and (c.name <> 'Admin Demo Club' or coalesce(c.image_url, '') = '');

with admin_user as (
  select id
  from auth.users
  where email = 'a.samad4651@gmail.com'
  limit 1
)
insert into public.clubs (name, description, location, schedule_day, schedule_time, lat, lng, owner_id)
values (
  'Admin Demo Club',
  'Demo club for admin account multi-view access',
  'Sydney CBD',
  'Wednesdays',
  '6:00 PM',
  -33.8688,
  151.2093,
  (select id from admin_user)
)
on conflict (name) do update
set
  description = excluded.description,
  location = excluded.location,
  schedule_day = excluded.schedule_day,
  schedule_time = excluded.schedule_time,
  lat = excluded.lat,
  lng = excluded.lng,
  owner_id = coalesce(excluded.owner_id, public.clubs.owner_id);

-- Keep custom admin demo image if already uploaded; otherwise use curated fallback.
update public.clubs
set image_url = 'https://picsum.photos/seed/admin-demo-club/1600/900'
where name = 'Admin Demo Club'
  and coalesce(image_url, '') = '';

-- Admin approval workflow (run manually as admin/service role):
-- 1) update public.club_owner_applications set status = 'approved', reviewed_at = now(), reviewed_by = '<admin-user-uuid>' where id = '<application-id>';
-- 2) update public.clubs set owner_id = '<approved-user-uuid>' where id = '<club-id>';
-- 3) update public.users set role = 'club_owner' where id = '<approved-user-uuid>';
