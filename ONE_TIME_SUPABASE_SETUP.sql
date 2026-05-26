-- SCES DASHBOARD - ONE TIME SUPABASE SETUP
-- Step 1: In Supabase, create/login to your project.
-- Step 2: Go to SQL Editor > New query.
-- Step 3: Paste this whole file and click RUN.
-- Step 4: Create the admin user in Authentication > Users.
-- Step 5: Run the MAKE_ADMIN query at the bottom after replacing the email if needed.

create extension if not exists pgcrypto;

create table if not exists public.school_year_data (
  id uuid primary key default gen_random_uuid(),
  school_year text not null unique,
  total_enrollment integer not null default 0 check (total_enrollment >= 0),
  kinder integer default 0 check (kinder >= 0),
  grade1 integer default 0 check (grade1 >= 0),
  grade2 integer default 0 check (grade2 >= 0),
  grade3 integer default 0 check (grade3 >= 0),
  grade4 integer default 0 check (grade4 >= 0),
  grade5 integer default 0 check (grade5 >= 0),
  grade6 integer default 0 check (grade6 >= 0),
  sped integer default 0 check (sped >= 0),
  teachers integer default 0 check (teachers >= 0),
  classrooms integer default 0 check (classrooms >= 0),
  dropouts integer default 0 check (dropouts >= 0),
  repeaters integer default 0 check (repeaters >= 0),
  attendance_rate numeric(5,2) default 100 check (attendance_rate >= 0 and attendance_rate <= 100),
  performance_rate numeric(5,2) default 0 check (performance_rate >= 0 and performance_rate <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists school_year_data_set_updated_at on public.school_year_data;
create trigger school_year_data_set_updated_at
before update on public.school_year_data
for each row execute function public.set_updated_at();

alter table public.school_year_data enable row level security;
alter table public.admins enable row level security;

drop policy if exists "Public can view school year data" on public.school_year_data;
create policy "Public can view school year data"
on public.school_year_data
for select
using (true);

drop policy if exists "Admins can insert school year data" on public.school_year_data;
create policy "Admins can insert school year data"
on public.school_year_data
for insert
to authenticated
with check (
  exists (select 1 from public.admins where admins.user_id = auth.uid())
);

drop policy if exists "Admins can update school year data" on public.school_year_data;
create policy "Admins can update school year data"
on public.school_year_data
for update
to authenticated
using (
  exists (select 1 from public.admins where admins.user_id = auth.uid())
)
with check (
  exists (select 1 from public.admins where admins.user_id = auth.uid())
);

drop policy if exists "Admins can delete school year data" on public.school_year_data;
create policy "Admins can delete school year data"
on public.school_year_data
for delete
to authenticated
using (
  exists (select 1 from public.admins where admins.user_id = auth.uid())
);

drop policy if exists "Users can view own admin status" on public.admins;
create policy "Users can view own admin status"
on public.admins
for select
to authenticated
using (user_id = auth.uid());

insert into public.school_year_data
(school_year,total_enrollment,kinder,grade1,grade2,grade3,grade4,grade5,grade6,sped,teachers,classrooms,dropouts,repeaters,attendance_rate,performance_rate,notes)
values
('2021-2022',1966,218,297,206,362,292,212,283,35,62,42,2,5,100,82,'Baseline year with highest enrollment'),
('2022-2023',1812,205,250,215,315,270,225,250,44,58,42,4,8,100,83,'Decline started after baseline'),
('2023-2024',1914,300,270,230,290,281,235,240,55,60,42,3,12,100,84,'Temporary recovery / spike'),
('2024-2025',1799,210,260,235,260,275,240,220,62,57,42,7,6,100,84.5,'Decline returned; highest dropout recorded'),
('2025-2026',1748,197,277,241,233,276,243,189,69,55,42,1,3,100,86,'Lowest enrollment in five-year range')
on conflict (school_year) do update set
  total_enrollment = excluded.total_enrollment,
  kinder = excluded.kinder,
  grade1 = excluded.grade1,
  grade2 = excluded.grade2,
  grade3 = excluded.grade3,
  grade4 = excluded.grade4,
  grade5 = excluded.grade5,
  grade6 = excluded.grade6,
  sped = excluded.sped,
  teachers = excluded.teachers,
  classrooms = excluded.classrooms,
  dropouts = excluded.dropouts,
  repeaters = excluded.repeaters,
  attendance_rate = excluded.attendance_rate,
  performance_rate = excluded.performance_rate,
  notes = excluded.notes;

-- MAKE ADMIN AFTER CREATING AUTH USER:
-- Replace email below if you use another email, then highlight only these 4 lines and RUN.
insert into public.admins (user_id, email)
select id, email from auth.users
where email = 'admin@sces.edu.ph'
on conflict (user_id) do update set email = excluded.email;
