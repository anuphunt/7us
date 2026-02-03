create extension if not exists "pgcrypto";

-- Employee override requests when geofence fails.
-- Admin can approve/deny; approval creates override clock event.

create table if not exists public.override_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid references public.stores(id),
  requested_event_type text not null check (requested_event_type in ('in','out')),
  requested_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  accuracy_m integer,
  distance_m integer,
  radius_m integer,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references public.users(id),
  review_reason text,
  created_clock_event_id uuid references public.clock_events(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists override_requests_status_idx on public.override_requests (status, requested_at desc);
create index if not exists override_requests_user_id_idx on public.override_requests (user_id, requested_at desc);

create or replace function public.set_updated_at_override_requests()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists override_requests_set_updated_at on public.override_requests;
create trigger override_requests_set_updated_at
before update on public.override_requests
for each row execute procedure public.set_updated_at_override_requests();

alter table if exists public.override_requests enable row level security;
