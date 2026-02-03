create extension if not exists "pgcrypto";

-- Shifts / Schedules
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_end_after_start check (end_at > start_at)
);

create index if not exists shifts_user_id_start_at_idx on public.shifts (user_id, start_at);
create index if not exists shifts_start_at_idx on public.shifts (start_at);

-- updated_at trigger (optional quality-of-life)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists shifts_set_updated_at on public.shifts;
create trigger shifts_set_updated_at
before update on public.shifts
for each row execute procedure public.set_updated_at();
