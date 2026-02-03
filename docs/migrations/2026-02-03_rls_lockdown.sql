-- RLS lockdown (custom auth app)
--
-- This app uses a custom cookie/session auth (not Supabase Auth).
-- Best practice: keep all DB access server-side via service-role key.
-- Enable RLS and do NOT create permissive policies for anon users.
-- Service role bypasses RLS for server API routes.

-- Tasks
alter table if exists public.tasks enable row level security;

-- Shifts
alter table if exists public.shifts enable row level security;

-- Hourly rates (admin-only via server)
alter table if exists public.hourly_rates enable row level security;

-- Clock events + audits
alter table if exists public.clock_events enable row level security;
alter table if exists public.clock_event_audits enable row level security;

-- Auth events
alter table if exists public.auth_events enable row level security;

-- Stores
alter table if exists public.stores enable row level security;

-- Deny all by default (no policies). If you later adopt Supabase Auth,
-- add explicit policies based on auth.uid() and roles.
