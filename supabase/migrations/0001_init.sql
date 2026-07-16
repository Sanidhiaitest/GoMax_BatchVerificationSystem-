-- GoMax Batch Verification System — core schema
-- All timestamps in tables that matter for audit are server-generated
-- (default now()) and are never written to by client-supplied values.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tunable settings (min tick gap, shift hours, etc.) editable by admins
-- without a redeploy.
-- ---------------------------------------------------------------------
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values
  ('min_tick_gap_seconds', '25'),
  ('shift_start_hour', '7'),
  ('shift_end_hour', '19'),
  ('plant_timezone', '"Asia/Kolkata"')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Admins (Sharad, Shivansh, Ravinder ji) — backed by Supabase Auth.
-- A row here promotes an auth.users identity to dashboard admin.
-- ---------------------------------------------------------------------
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Supervisors — identified by 4-digit PIN, not free text. The PIN is
-- hashed (bcrypt via pgcrypto) so it is never stored or returned in
-- plaintext. Login is done via the login_supervisor_pin() RPC.
-- ---------------------------------------------------------------------
create table supervisors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Public-safe view for the dashboard supervisor list (never exposes pin_hash).
create view supervisors_public as
  select id, name, active, created_at from supervisors;

-- Maps a device's anonymous Supabase Auth identity to the supervisor who
-- most recently logged in with their PIN on that device. Re-entering a
-- different PIN on the same device/browser switches the mapping, which is
-- how a shared mixing-station phone can be used by multiple supervisors.
create table device_links (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  supervisor_id uuid not null references supervisors(id),
  last_login_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Master formulation list — editable in the admin dashboard. Changes to
-- a formulation's materials automatically apply to every future batch
-- checklist for that formulation (existing/in-flight batches keep the
-- snapshot they were started with, see batch_materials below).
-- ---------------------------------------------------------------------
create table formulations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table formulation_materials (
  id uuid primary key default gen_random_uuid(),
  formulation_id uuid not null references formulations(id) on delete cascade,
  description text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index formulation_materials_formulation_id_idx
  on formulation_materials (formulation_id) where active;

-- ---------------------------------------------------------------------
-- Batches. batch_date is derived from the plant's local timezone so
-- "unique per day" matches how the floor actually thinks about a day,
-- and is enforced with a database-level unique constraint (not just UI
-- validation).
-- ---------------------------------------------------------------------
create table batches (
  id uuid primary key default gen_random_uuid(),
  formulation_id uuid not null references formulations(id),
  supervisor_id uuid not null references supervisors(id),
  batch_number text not null,
  batch_date date not null default (
    (now() at time zone 'Asia/Kolkata')::date
  ),
  mason_name text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_number, batch_date)
);

create index batches_supervisor_id_idx on batches (supervisor_id);
create index batches_formulation_id_idx on batches (formulation_id);
create index batches_batch_date_idx on batches (batch_date);

-- Snapshot of the formulation's material list at the moment the batch was
-- started, so later edits to the master formulation don't rewrite a batch
-- that is already in progress or submitted.
create table batch_materials (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  formulation_material_id uuid references formulation_materials(id),
  description text not null,
  sort_order int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'added', 'skipped')),
  quantity numeric,
  ticked_at timestamptz,
  suspicious boolean not null default false,
  gap_seconds numeric,
  created_at timestamptz not null default now(),
  unique (batch_id, formulation_material_id)
);

create index batch_materials_batch_id_idx on batch_materials (batch_id);

-- Flags surfaced on the dashboard: hard-rule (deterministic) and AI
-- (judgment-based) flags share this table so the dashboard renders them
-- uniformly.
create table batch_flags (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  source text not null check (source in ('rule', 'ai')),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  code text,
  message text not null,
  created_at timestamptz not null default now()
);

create index batch_flags_batch_id_idx on batch_flags (batch_id);
