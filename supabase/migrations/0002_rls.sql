-- Row Level Security + immutability guarantees.
--
-- Strategy: anon/authenticated roles get read-only access shaped by role
-- (supervisor vs admin). All writes to batches/batch_materials/batch_flags
-- go through SECURITY DEFINER RPCs (0003_rpc.sql), which run as the table
-- owner and therefore bypass RLS — so RLS on those tables denies *direct*
-- client writes entirely. Triggers add a second, independent layer that
-- blocks edits/deletes on submitted batches even if a bug ever let a
-- direct write through.

alter table app_settings enable row level security;
alter table admin_users enable row level security;
alter table supervisors enable row level security;
alter table device_links enable row level security;
alter table formulations enable row level security;
alter table formulation_materials enable row level security;
alter table batches enable row level security;
alter table batch_materials enable row level security;
alter table batch_flags enable row level security;

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_users where auth_user_id = auth.uid()
  );
$$;

create or replace function current_supervisor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select supervisor_id from device_links where auth_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- app_settings: admins can read/write, everyone else no direct access
-- (RPCs read settings server-side as SECURITY DEFINER).
-- ---------------------------------------------------------------------
create policy app_settings_admin_all on app_settings
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- admin_users: an admin can see the admin roster; no client-side inserts
-- (bootstrapped via SQL/service role only).
-- ---------------------------------------------------------------------
create policy admin_users_select on admin_users
  for select using (is_admin());

-- ---------------------------------------------------------------------
-- supervisors: raw table (with pin_hash) is never selectable by clients.
-- Admin dashboard reads supervisors_public instead. Writes only via RPC.
-- ---------------------------------------------------------------------
-- (no select/insert/update/delete policies -> RLS default-denies all
-- direct client access; RPCs bypass via SECURITY DEFINER)

grant select on supervisors_public to authenticated, anon;

-- ---------------------------------------------------------------------
-- device_links: a device may only see/manage its own mapping. Writes are
-- done via the login_supervisor_pin() RPC only.
-- ---------------------------------------------------------------------
create policy device_links_select_own on device_links
  for select using (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- formulations / formulation_materials: readable by any logged-in device
-- (supervisor app needs the material list); writable only by admins.
-- ---------------------------------------------------------------------
create policy formulations_select on formulations
  for select using (auth.uid() is not null);

create policy formulations_admin_write on formulations
  for insert with check (is_admin());
create policy formulations_admin_update on formulations
  for update using (is_admin()) with check (is_admin());

create policy formulation_materials_select on formulation_materials
  for select using (auth.uid() is not null);

create policy formulation_materials_admin_write on formulation_materials
  for insert with check (is_admin());
create policy formulation_materials_admin_update on formulation_materials
  for update using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- batches: supervisors see their own batches, admins see everything.
-- No insert/update/delete policies for any client role — all writes go
-- through start_batch()/tick_material()/submit_batch() RPCs.
-- ---------------------------------------------------------------------
create policy batches_select on batches
  for select using (is_admin() or supervisor_id = current_supervisor_id());

create policy batch_materials_select on batch_materials
  for select using (
    is_admin()
    or exists (
      select 1 from batches b
      where b.id = batch_materials.batch_id
        and b.supervisor_id = current_supervisor_id()
    )
  );

create policy batch_flags_select on batch_flags
  for select using (is_admin());

-- ---------------------------------------------------------------------
-- Immutability triggers (defense in depth, independent of RLS/RPC logic).
-- ---------------------------------------------------------------------
create or replace function forbid_batch_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'batches are append-only: delete is not permitted';
  end if;
  if old.status = 'submitted' then
    raise exception 'batch % is submitted and immutable', old.id;
  end if;
  return new;
end;
$$;

create trigger batches_no_delete
  before delete on batches
  for each row execute function forbid_batch_mutation();

create trigger batches_no_edit_after_submit
  before update on batches
  for each row execute function forbid_batch_mutation();

create or replace function forbid_batch_material_mutation()
returns trigger
language plpgsql
as $$
declare
  batch_status text;
begin
  select status into batch_status from batches where id = coalesce(old.batch_id, new.batch_id);

  if tg_op = 'DELETE' then
    raise exception 'batch materials are append-only: delete is not permitted';
  end if;

  if batch_status = 'submitted' then
    raise exception 'parent batch is submitted; materials are immutable';
  end if;

  return new;
end;
$$;

create trigger batch_materials_no_delete
  before delete on batch_materials
  for each row execute function forbid_batch_material_mutation();

create trigger batch_materials_no_edit_after_submit
  before update on batch_materials
  for each row execute function forbid_batch_material_mutation();

create or replace function forbid_flag_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'batch flags are insert-only';
end;
$$;

create trigger batch_flags_no_update
  before update on batch_flags
  for each row execute function forbid_flag_mutation();

create trigger batch_flags_no_delete
  before delete on batch_flags
  for each row execute function forbid_flag_mutation();
