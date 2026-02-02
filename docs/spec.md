# Employee management app — MVP Spec (v0)

## Goal
A private PWA for a single convenience store to manage time clock (geo-restricted), schedules, and tasks. Includes earnings visibility for each employee (private) and full admin oversight.

## Users / roles
- Employees (~4)
- Admins (~2)

### Role capabilities
Employees:
- Log in with POS-style credentials (userId: 2 digits, PIN: 4 digits)
- Clock in/out only within store geofence (200m)
- View schedules: self + other employees
- View tasks: self + other employees
- Mark tasks complete
- View earnings: per-shift/day, MTD, YTD (self only)
  - Earnings only count finalized sessions (clock-out required)

Admins:
- Full CRUD on employees, schedules, tasks
- Edit timesheets: create/edit/delete clock events when someone forgets
- Set hourly rates (effective-dated)
- View earnings for all employees
- Birds-eye dashboard

## Policies / rules
- Earnings only based on finalized sessions (clock-out required); missing clock-out is excluded until fixed by admin.
- Geofence: allow clock events only if within 200m of store coordinates.
- Payroll rules:
  - Round to nearest minute
  - No unpaid breaks
  - No overtime
- Earnings privacy: employees cannot view others’ earnings.

## Screens (PWA)

### Auth
- Login (userId + PIN)

### Employee
- Home dashboard
  - Current status (clocked in/out)
  - Quick actions: Clock in / Clock out
  - Today’s earnings
- Schedule
  - My shifts
  - Team schedule
- Tasks
  - Filter by date range
  - Mark complete
- Earnings
  - Shift/day list
  - MTD and YTD totals

### Admin
- Admin dashboard
  - Who is clocked in
  - Exceptions (missing clock-out, geofence failures)
  - Upcoming shifts
  - Overdue tasks
- People
  - Create/disable employee
  - Reset PIN
  - Set hourly rate (effective date)
- Timesheets
  - List sessions by date range + employee
  - Add clock-in/out events (override)
  - Edit/delete events (audited)
- Scheduling
  - CRUD shifts
- Tasks
  - CRUD tasks

## Data model (Postgres)

### stores
- id (uuid)
- name
- lat
- lng
- radius_m (default 200)
- tz

### users
- id (uuid)
- user_id_short (char(2)) UNIQUE
- pin_hash (text)
- role (enum: admin|employee)
- name
- active (bool)
- created_at

### hourly_rates
- id
- user_id (fk users.id)
- rate_cents
- effective_from
- effective_to (nullable)

### clock_events (append-only preferred)
- id
- user_id
- store_id
- event_type (in|out)
- occurred_at
- lat
- lng
- accuracy_m
- is_override (bool)
- created_by_user_id (nullable)
- created_at
- reason (nullable)

### work_sessions (derived view or table)
- id
- user_id
- clock_in_event_id
- clock_out_event_id
- started_at
- ended_at
- minutes
- pay_cents

### shifts
- id
- user_id
- start_at
- end_at
- notes
- created_by_user_id

### tasks
- id
- title
- details
- start_at
- due_at
- status (todo|done)
- completed_at
- completed_by_user_id
- created_by_user_id

## Security (minimum)
- Argon2id for PIN hashing
- Rate limits + lockout (per user + per IP)
- Audit log for admin overrides and auth failures
- Session cookies (httpOnly)


## UX decisions
- Theme: light mode only (MVP)
- Branding: 7-Eleven colors
- Clock geo failure: employee can request admin override (does not create a clock event until admin action)

## Clock button rules
- Single stateful button:
  - when clocked out: "Clock In"
  - when clocked in: "Clock Out"
- Disallow invalid transitions:
  - cannot clock in if already clocked in
  - cannot clock out if not clocked in
- Timer runs while clocked in (informational)
- Earnings only finalize on clock-out
