create extension if not exists "pgcrypto";

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  start_at timestamptz,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'done')),
  completed_at timestamptz,
  completed_by uuid references public.users (id) on delete set null,
  created_by uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_due_at_idx on public.tasks (due_at desc nulls last);
create index if not exists tasks_start_at_idx on public.tasks (start_at desc nulls last);
create index if not exists tasks_created_at_idx on public.tasks (created_at desc);
