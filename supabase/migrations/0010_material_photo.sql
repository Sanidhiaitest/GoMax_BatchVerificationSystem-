-- Mandatory photo evidence, per material — configurable per material (not
-- every material), starting with Silica Sand. Admins can flip
-- requires_photo on any other material later from the Products page; no
-- further SQL needed for that.
--
-- requires_photo lives on formulation_materials (the master list) and is
-- snapshotted onto batch_materials when a batch starts, same pattern as
-- description/sort_order already being copied — so a batch already in
-- progress isn't affected by a later admin toggle.

alter table formulation_materials
  add column requires_photo boolean not null default false;

alter table batch_materials
  add column requires_photo boolean not null default false,
  add column photo_path text;

-- Turn it on for Silica Sand right now, wherever it appears.
update formulation_materials
set requires_photo = true
where description ilike '%silica sand%';

-- start_batch now also snapshots requires_photo onto batch_materials.
drop function if exists start_batch(uuid, text, text);

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

  insert into batch_materials (batch_id, formulation_material_id, description, sort_order, requires_photo)
  select new_batch_id, fm.id, fm.description, fm.sort_order, fm.requires_photo
  from formulation_materials fm
  where fm.formulation_id = p_formulation_id
    and fm.active
  order by fm.sort_order;

  return new_batch_id;
end;
$$;

-- tick_material now requires a photo path when marking a material "added"
-- IF that material's snapshot says requires_photo — exactly like it already
-- requires a quantity for every material. Skipping never needs either.
-- Previous 3-argument signature is dropped first so a call doesn't become
-- ambiguous between overloads.
drop function if exists tick_material(uuid, text, numeric);

create or replace function tick_material(
  p_batch_material_id uuid,
  p_status text,
  p_quantity numeric default null,
  p_photo_path text default null
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

  select * into bm from batch_materials where id = p_batch_material_id;
  if not found then
    raise exception 'material not found';
  end if;

  if p_status = 'added' and p_quantity is null then
    raise exception 'quantity is required to mark a material as added';
  end if;
  if p_status = 'added' and bm.requires_photo and p_photo_path is null then
    raise exception 'photo is required to mark % as added', bm.description;
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
      photo_path = p_photo_path,
      ticked_at = now(),
      suspicious = is_suspicious,
      gap_seconds = gap
  where id = p_batch_material_id;

  if is_suspicious then
    insert into batch_flags (batch_id, source, severity, code, message)
    values (
      b.id,
      'rule',
      'warning',
      'fast_tick',
      format('Material "%s" was marked %s only %s seconds after the previous one.', bm.description, p_status, round(gap))
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Private storage bucket for material photo evidence. Any logged-in
-- device can upload (the RPC above is the real gate on which batch/material
-- it belongs to); admins and any logged-in supervisor/tester can read back,
-- same loose-within-trusted-roles model as testing-photos.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('material-photos', 'material-photos', false)
on conflict (id) do nothing;

drop policy if exists material_photos_insert on storage.objects;
create policy material_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'material-photos' and current_supervisor_id() is not null);

drop policy if exists material_photos_select on storage.objects;
create policy material_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'material-photos' and (is_admin() or current_supervisor_id() is not null));
