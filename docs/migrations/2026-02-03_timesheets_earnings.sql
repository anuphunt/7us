create extension if not exists "pgcrypto";

-- Core tables for timesheets + earnings

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text,
  lat double precision,
  lng double precision,
  radius_m integer not null default 200,
  tz text not null default 'America/Los_Angeles',
  created_at timestamptz not null default now()
);

-- Effective-dated hourly rates
create table if not exists public.hourly_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  rate_cents integer not null check (rate_cents >= 0),
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references public.users(id),
  note text
);

create index if not exists hourly_rates_user_id_idx on public.hourly_rates (user_id);
create index if not exists hourly_rates_effective_from_idx on public.hourly_rates (effective_from desc);

-- Clock events (soft-deletable; admin overrides allowed)
create table if not exists public.clock_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid references public.stores(id),
  event_type text not null check (event_type in ('in', 'out')),
  occurred_at timestamptz not null,
  lat double precision,
  lng double precision,
  accuracy_m integer,
  is_override boolean not null default false,
  reason text,
  created_by_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_by_user_id uuid references public.users(id),
  updated_at timestamptz,
  deleted_by_user_id uuid references public.users(id),
  deleted_at timestamptz
);

-- If the table existed from earlier iterations, ensure all new columns exist.
alter table public.clock_events
  add column if not exists store_id uuid references public.stores(id),
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists accuracy_m integer,
  add column if not exists is_override boolean not null default false,
  add column if not exists reason text,
  add column if not exists created_by_user_id uuid references public.users(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_by_user_id uuid references public.users(id),
  add column if not exists updated_at timestamptz,
  add column if not exists deleted_by_user_id uuid references public.users(id),
  add column if not exists deleted_at timestamptz;

create index if not exists clock_events_user_id_occurred_at_idx on public.clock_events (user_id, occurred_at desc);
create index if not exists clock_events_store_id_occurred_at_idx on public.clock_events (store_id, occurred_at desc);
create index if not exists clock_events_occurred_at_idx on public.clock_events (occurred_at desc);
create index if not exists clock_events_not_deleted_idx on public.clock_events (user_id, occurred_at desc) where deleted_at is null;

-- Audit trail for admin overrides / edits / deletes.
create table if not exists public.clock_event_audits (
  id uuid primary key default gen_random_uuid(),
  clock_event_id uuid references public.clock_events(id) on delete set null,
  action text not null check (action in ('create','update','delete')),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references public.users(id),
  reason text not null,
  before jsonb,
  after jsonb
);

create index if not exists clock_event_audits_clock_event_id_idx on public.clock_event_audits (clock_event_id);
create index if not exists clock_event_audits_occurred_at_idx on public.clock_event_audits (occurred_at desc);

-- Derived sessions (finalized sessions have an out event)
-- Rules:
-- - Pair each IN with the first OUT after it, but before the next IN.
-- - Exclude soft-deleted clock events.
-- - Round to nearest minute.
-- - Earnings only computed for finalized sessions (clock-out present).
create or replace view public.work_sessions as
with events as (
  select *
  from public.clock_events
  where deleted_at is null
),
ins as (
  select
    e.id as clock_in_event_id,
    e.user_id,
    e.store_id,
    e.occurred_at as started_at,
    -- next IN after this IN (used to bound the OUT search)
    min(case when e.event_type = 'in' then e.occurred_at end) over (
      partition by e.user_id
      order by e.occurred_at
      rows between 1 following and unbounded following
    ) as next_in_at
  from events e
  where e.event_type = 'in'
),
paired as (
  select
    i.user_id,
    i.store_id,
    i.clock_in_event_id,
    o.id as clock_out_event_id,
    i.started_at,
    o.occurred_at as ended_at
  from ins i
  left join lateral (
    select e.*
    from events e
    where e.user_id = i.user_id
      and e.event_type = 'out'
      and e.occurred_at > i.started_at
      and (i.next_in_at is null or e.occurred_at < i.next_in_at)
    order by e.occurred_at asc
    limit 1
  ) o on true
),
computed as (
  select
    (p.clock_in_event_id)::text as id,
    p.user_id,
    p.store_id,
    p.clock_in_event_id,
    p.clock_out_event_id,
    p.started_at,
    p.ended_at,
    case
      when p.ended_at is null then null
      else round(extract(epoch from (p.ended_at - p.started_at)) / 60.0)::int
    end as minutes
  from paired p
)
select
  c.id,
  c.user_id,
  c.store_id,
  c.clock_in_event_id,
  c.clock_out_event_id,
  c.started_at,
  c.ended_at,
  c.minutes,
  (c.ended_at is not null) as finalized,
  r.rate_cents,
  case
    when c.ended_at is null then null
    when r.rate_cents is null then null
    else round((c.minutes * r.rate_cents) / 60.0)::int
  end as pay_cents
from computed c
left join lateral (
  select hr.rate_cents
  from public.hourly_rates hr
  where hr.user_id = c.user_id
    and hr.effective_from <= c.started_at
    and (hr.effective_to is null or hr.effective_to > c.started_at)
  order by hr.effective_from desc
  limit 1
) r on true;
