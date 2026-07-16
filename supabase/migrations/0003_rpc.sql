-- All state-changing operations go through these SECURITY DEFINER RPCs.
-- This is what makes the "non-negotiable" rules actually enforceable:
-- every timestamp below comes from now(), never from a function argument,
-- so a client can't backdate/forge one. The minimum-tick-gap check lives
-- here too, so it can't be bypassed by editing the frontend.

-- `value #>> '{}'` (get-as-text at the root path) is the idiomatic way to
-- unwrap a jsonb scalar: it strips quotes from JSON strings and, critically,
-- returns SQL NULL for a JSON null value (unlike `value::text`, which would
-- return the four characters "null").
create or replace function get_setting_numeric(setting_key text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select (value #>> '{}')::numeric from app_settings where key = setting_key;
$$;

create or replace function get_setting_text(setting_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value #>> '{}' from app_settings where key = setting_key;
$$;

-- ---------------------------------------------------------------------
-- Supervisor identity
-- ---------------------------------------------------------------------

-- Called by an admin (from the dashboard) to create a supervisor account.
create or replace function admin_create_supervisor(p_name text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not is_admin() then
    raise exception 'only admins can create supervisors';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'pin must be exactly 4 digits';
  end if;

  insert into supervisors (name, pin_hash)
  values (p_name, crypt(p_pin, gen_salt('bf')))
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function admin_set_supervisor_pin(p_supervisor_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'only admins can change a supervisor pin';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'pin must be exactly 4 digits';
  end if;

  update supervisors set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_supervisor_id;
end;
$$;

create or replace function admin_set_supervisor_active(p_supervisor_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'only admins can change supervisor status';
  end if;
  update supervisors set active = p_active where id = p_supervisor_id;
end;
$$;

-- Called by the supervisor PWA after an anonymous Supabase Auth session
-- has been established on the device. Maps that device session to the
-- supervisor identified by PIN. Returns supervisor id + name so the app
-- can greet them; never returns or accepts anything that looks like a
-- free-text name for login purposes.
create or replace function login_supervisor_pin(p_pin text)
returns table (supervisor_id uuid, supervisor_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched supervisors%rowtype;
begin
  if auth.uid() is null then
    raise exception 'no device session';
  end if;

  select s.* into matched
  from supervisors s
  where s.active
    and s.pin_hash = crypt(p_pin, s.pin_hash)
  limit 1;

  if not found then
    raise exception 'invalid pin';
  end if;

  insert into device_links (auth_user_id, supervisor_id, last_login_at)
  values (auth.uid(), matched.id, now())
  on conflict (auth_user_id)
  do update set supervisor_id = excluded.supervisor_id, last_login_at = now();

  return query select matched.id, matched.name;
end;
$$;

-- ---------------------------------------------------------------------
-- Batch lifecycle
-- ---------------------------------------------------------------------

create or replace function start_batch(
  p_formulation_id uuid,
  p_batch_number text,
  p_mason_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sup_id uuid := current_supervisor_id();
  new_batch_id uuid;
begin
  if sup_id is null then
    raise exception 'no supervisor is logged in on this device';
  end if;
  if p_batch_number is null or length(trim(p_batch_number)) = 0 then
    raise exception 'batch number is required';
  end if;
  if p_mason_name is null or length(trim(p_mason_name)) = 0 then
    raise exception 'mason name is required';
  end if;

  begin
    insert into batches (formulation_id, supervisor_id, batch_number, mason_name, started_at)
    values (p_formulation_id, sup_id, trim(p_batch_number), trim(p_mason_name), now())
    returning id into new_batch_id;
  exception when unique_violation then
    raise exception 'duplicate_batch_number: a batch numbered % already exists today', p_batch_number;
  end;

  insert into batch_materials (batch_id, formulation_material_id, description, sort_order)
  select new_batch_id, fm.id, fm.description, fm.sort_order
  from formulation_materials fm
  where fm.formulation_id = p_formulation_id
    and fm.active
  order by fm.sort_order;

  return new_batch_id;
end;
$$;

-- Ticks (or crosses) a single material. Quantity is required to mark a
-- material "added" per spec. The minimum-gap-between-ticks check is
-- computed here, server-side, from server timestamps only: a tick that
-- comes in too fast is not blocked, it is flagged "suspicious" for the
-- dashboard, matching the spec ("don't block, flag it").
create or replace function tick_material(
  p_batch_material_id uuid,
  p_status text,
  p_quantity numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sup_id uuid := current_supervisor_id();
  bm batch_materials%rowtype;
  b batches%rowtype;
  last_tick timestamptz;
  gap numeric;
  min_gap numeric := coalesce(get_setting_numeric('min_tick_gap_seconds'), 25);
  is_suspicious boolean := false;
begin
  if sup_id is null then
    raise exception 'no supervisor is logged in on this device';
  end if;
  if p_status not in ('added', 'skipped') then
    raise exception 'status must be added or skipped';
  end if;
  if p_status = 'added' and p_quantity is null then
    raise exception 'quantity is required to mark a material as added';
  end if;

  select * into bm from batch_materials where id = p_batch_material_id;
  if not found then
    raise exception 'material not found';
  end if;

  select * into b from batches where id = bm.batch_id;
  if b.supervisor_id <> sup_id then
    raise exception 'this batch does not belong to the logged-in supervisor';
  end if;
  if b.status <> 'in_progress' then
    raise exception 'batch is already submitted and immutable';
  end if;

  select max(ticked_at) into last_tick
  from batch_materials
  where batch_id = b.id and ticked_at is not null;

  if last_tick is not null then
    gap := extract(epoch from (now() - last_tick));
    if gap < min_gap then
      is_suspicious := true;
    end if;
  end if;

  update batch_materials
  set status = p_status,
      quantity = p_quantity,
      ticked_at = now(),
      suspicious = is_suspicious,
      gap_seconds = gap
  where id = p_batch_material_id;

  if is_suspicious then
    insert into batch_flags (batch_id, source, severity, code, message)
    values (
      b.id, 'rule', 'warning', 'fast_tick',
      format('Material "%s" was ticked only %s seconds after the previous tick (minimum expected: %s s).',
             bm.description, round(gap, 1), min_gap)
    );
  end if;
end;
$$;

-- Locks the batch. No further edits are possible after this (enforced
-- both here and by the immutability triggers). Also runs the
-- deterministic checks that don't need judgment: off-hours submission and
-- materials left pending (missing items).
create or replace function submit_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sup_id uuid := current_supervisor_id();
  b batches%rowtype;
  tz text := coalesce(get_setting_text('plant_timezone'), 'Asia/Kolkata');
  shift_start int := coalesce(get_setting_numeric('shift_start_hour'), 7)::int;
  shift_end int := coalesce(get_setting_numeric('shift_end_hour'), 19)::int;
  local_hour int;
  missing_count int;
  now_ts timestamptz := now();
begin
  select * into b from batches where id = p_batch_id;
  if not found then
    raise exception 'batch not found';
  end if;
  if b.supervisor_id <> sup_id then
    raise exception 'this batch does not belong to the logged-in supervisor';
  end if;
  if b.status <> 'in_progress' then
    raise exception 'batch is already submitted';
  end if;

  update batches set status = 'submitted', submitted_at = now_ts where id = p_batch_id;

  select count(*) into missing_count
  from batch_materials
  where batch_id = p_batch_id and status = 'pending';

  if missing_count > 0 then
    insert into batch_flags (batch_id, source, severity, code, message)
    values (
      p_batch_id, 'rule', 'critical', 'missing_item',
      format('%s material(s) were submitted without being ticked or crossed.', missing_count)
    );
  end if;

  local_hour := extract(hour from (now_ts at time zone tz));
  if local_hour < shift_start or local_hour >= shift_end then
    insert into batch_flags (batch_id, source, severity, code, message)
    values (
      p_batch_id, 'rule', 'warning', 'off_hours',
      format('Batch was submitted at %s local time, outside the normal %s:00-%s:00 shift window.',
             to_char(now_ts at time zone tz, 'HH24:MI'), shift_start, shift_end)
    );
  end if;
end;
$$;
