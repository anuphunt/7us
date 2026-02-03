create extension if not exists "pgcrypto";

-- Users: add lockout tracking fields (compatible with existing table)
alter table public.users
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists last_failed_at timestamptz;

-- Audit log for auth/admin activity
create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id_short text,
  user_id uuid,
  ip text,
  user_agent text,
  event_type text not null,
  success boolean not null,
  reason text
);

create index if not exists auth_events_occurred_at_idx on public.auth_events (occurred_at desc);
create index if not exists auth_events_user_id_idx on public.auth_events (user_id);
create index if not exists auth_events_user_id_short_idx on public.auth_events (user_id_short);
create index if not exists auth_events_ip_idx on public.auth_events (ip);
