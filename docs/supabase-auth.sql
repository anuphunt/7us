-- Minimal auth table for PIN login
create type user_role as enum ('admin', 'employee');

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  user_id_short char(2) unique not null,
  pin_hash text not null,
  role user_role not null default 'employee',
  name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists users_user_id_short_idx on public.users (user_id_short);
