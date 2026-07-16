-- Lab testing workflow: a second role (tester, e.g. "Varun") who reviews
-- already-submitted batches for pass/fail QC, independent of the admin
-- dashboard. Same PIN-identity system as supervisors — no separate app,
-- no separate login mechanism — just a `role` column that changes which
-- screens the supervisor-app shows after PIN login.

alter table supervisors
  add column role text not null default 'supervisor' check (role in ('supervisor', 'tester'));

create or replace function is_tester()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from supervisors
    where id = current_supervisor_id() and role = 'tester' and active
  );
$$;

-- ---------------------------------------------------------------------
-- Batch columns for the testing workflow. Deliberately separate from the
-- production fields (formulation/materials/ticks) that the immutability
-- trigger protects — testing happens strictly after a batch is submitted
-- and is its own append-only-ish lifecycle layered on top.
-- ---------------------------------------------------------------------
alter table batches
  add column testing_status text not null default 'not_sent'
    check (testing_status in ('not_sent', 'pending', 'in_progress', 'passed', 'failed')),
  add column sent_for_testing_at timestamptz,
  add column tester_id uuid references supervisors(id),
  add column testing_started_at timestamptz,
  add column testing_completed_at timestamptz,
  add column test_remarks text,
  add column test_remarks_audio_path text;

create index batches_testing_status_idx on batches (testing_status);
create index batches_tester_id_idx on batches (tester_id);

-- ---------------------------------------------------------------------
-- Relax the "no edits after submit" trigger: once a batch is submitted,
-- the production/audit fields (formulation, ticks, quantities, submitted
-- timestamp, etc.) stay frozen exactly as before, but the testing columns
-- above must still be writable by the RPCs below. Compare the protected
-- fields explicitly instead of blanket-blocking every update.
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
    if new.formulation_id is distinct from old.formulation_id
      or new.supervisor_id is distinct from old.supervisor_id
      or new.batch_number is distinct from old.batch_number
      or new.batch_date is distinct from old.batch_date
      or new.mason_name is distinct from old.mason_name
      or new.status is distinct from old.status
      or new.started_at is distinct from old.started_at
      or new.submitted_at is distinct from old.submitted_at
    then
      raise exception 'batch % is submitted; only lab-testing fields may still change', old.id;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Testing lifecycle RPCs — same pattern as the batch RPCs: SECURITY
-- DEFINER, server-only timestamps, ownership/role checks.
-- ---------------------------------------------------------------------

-- Called by the supervisor who owns the batch, once it's submitted.
create or replace function send_batch_for_testing(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b batches%rowtype;
begin
  select * into b from batches where id = p_batch_id;
  if not found then
    raise exception 'batch not found';
  end if;
  if b.supervisor_id <> current_supervisor_id() then
    raise exception 'this batch does not belong to the logged-in supervisor';
  end if;
  if b.status <> 'submitted' then
    raise exception 'batch must be submitted before it can be sent for testing';
  end if;
  if b.testing_status <> 'not_sent' then
    raise exception 'batch has already been sent for testing';
  end if;

  update batches
  set testing_status = 'pending', sent_for_testing_at = now()
  where id = p_batch_id;
end;
$$;

-- Called by a tester to claim a pending item off the queue.
create or replace function start_testing(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b batches%rowtype;
begin
  if not is_tester() then
    raise exception 'only a tester can start testing';
  end if;

  select * into b from batches where id = p_batch_id;
  if not found then
    raise exception 'batch not found';
  end if;
  if b.testing_status <> 'pending' then
    raise exception 'batch is not waiting for testing';
  end if;

  update batches
  set testing_status = 'in_progress',
      tester_id = current_supervisor_id(),
      testing_started_at = now()
  where id = p_batch_id;
end;
$$;

-- Called by the tester who started it, to record pass/fail + remarks.
-- Audio is optional (uploaded separately to the testing-audio storage
-- bucket by the client, which passes the resulting path here).
create or replace function complete_testing(
  p_batch_id uuid,
  p_result text,
  p_remarks text,
  p_remarks_audio_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b batches%rowtype;
begin
  if p_result not in ('passed', 'failed') then
    raise exception 'result must be passed or failed';
  end if;

  select * into b from batches where id = p_batch_id;
  if not found then
    raise exception 'batch not found';
  end if;
  if b.testing_status <> 'in_progress' then
    raise exception 'testing was not started for this batch';
  end if;
  if b.tester_id <> current_supervisor_id() then
    raise exception 'only the tester who started this can complete it';
  end if;

  update batches
  set testing_status = p_result,
      testing_completed_at = now(),
      test_remarks = p_remarks,
      test_remarks_audio_path = p_remarks_audio_path
  where id = p_batch_id;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_create_supervisor gains a role parameter (defaults to
-- 'supervisor' so every existing call site keeps working unchanged).
-- The old 2-argument signature is dropped first — otherwise Postgres
-- would keep both overloads around and a 2-argument call becomes
-- ambiguous between them.
-- ---------------------------------------------------------------------
drop function if exists admin_create_supervisor(text, text);

create or replace function admin_create_supervisor(p_name text, p_pin text, p_role text default 'supervisor')
returns uuid
language plpgsql
security definer
set search_path = public, extensions
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
  if p_role not in ('supervisor', 'tester') then
    raise exception 'role must be supervisor or tester';
  end if;

  begin
    insert into supervisors (name, pin_hash, role)
    values (p_name, crypt(p_pin, gen_salt('bf')), p_role)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'duplicate_supervisor_name: an active supervisor named % already exists', p_name;
  end;

  return new_id;
end;
$$;

-- ---------------------------------------------------------------------
-- login_supervisor_pin now also returns role, so the app can route a
-- tester to the testing queue instead of the batch-checklist flow.
-- ---------------------------------------------------------------------
drop function if exists login_supervisor_pin(text);

create or replace function login_supervisor_pin(p_pin text)
returns table (supervisor_id uuid, supervisor_name text, supervisor_role text)
language plpgsql
security definer
set search_path = public, extensions
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

  return query select matched.id, matched.name, matched.role;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS: testers need to see batches that are theirs to test even though
-- they didn't supervise them, and admins/testers need read access to the
-- testers list for filtering/attribution. supervisors_public already
-- exposes name/active/role-free; extend the view to include role so the
-- dashboard can label testers distinctly without touching the raw table.
-- ---------------------------------------------------------------------
drop view if exists supervisors_public;
create view supervisors_public as
  select id, name, active, role, created_at from supervisors;
grant select on supervisors_public to authenticated, anon;

drop policy if exists batches_select on batches;
create policy batches_select on batches
  for select using (
    is_admin()
    or supervisor_id = current_supervisor_id()
    or tester_id = current_supervisor_id()
    or (testing_status = 'pending' and is_tester())
  );

drop policy if exists batch_materials_select on batch_materials;
create policy batch_materials_select on batch_materials
  for select using (
    is_admin()
    or exists (
      select 1 from batches b
      where b.id = batch_materials.batch_id
        and (
          b.supervisor_id = current_supervisor_id()
          or b.tester_id = current_supervisor_id()
          or (b.testing_status = 'pending' and is_tester())
        )
    )
  );

-- ---------------------------------------------------------------------
-- Storage bucket for Varun's optional voice-note remarks. Private bucket:
-- any logged-in device (supervisor or tester) can upload, but only admins
-- and testers can read it back (the admin dashboard fetches a short-lived
-- signed URL to play it).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('testing-audio', 'testing-audio', false)
on conflict (id) do nothing;

drop policy if exists testing_audio_insert on storage.objects;
create policy testing_audio_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'testing-audio' and current_supervisor_id() is not null);

drop policy if exists testing_audio_select on storage.objects;
create policy testing_audio_select on storage.objects
  for select to authenticated
  using (bucket_id = 'testing-audio' and (is_admin() or is_tester()));
