-- Backfill formulation_materials.standard_quantity with the plant's real
-- per-batch material tables (12 GoMax products), supplied by Ravinder ji /
-- Shivansh over WhatsApp. Batch basis is 1200kg for most products, 1000kg
-- for Rockcrete 280 and Grout 2 (as labeled in the source tables) — the
-- quantities below are copied as-is from those tables.
--
-- This environment has no live database access, so exact existing
-- `formulations.code` strings for these products can't be confirmed ahead
-- of time. The block below is self-healing instead of assuming codes:
-- for each product it first tries to find an already-existing formulation
-- (by code, by base_name+variant, or by name), and only creates a new one
-- if genuinely nothing matches. Same for each material line, matched by a
-- normalized description so things like "PP Fibre" / "P.P fibre" /
-- "P.P Fibre" in the source tables collapse to the same row. Newly
-- created formulations are left with category = null ("Not categorized")
-- rather than guessing — the admin dashboard's Grouping editor is the
-- right place to set that.
--
-- GOMAX GROUT 2's source table has two separate, identically-labeled
-- "Silica Sand" lines (250.0 and 130.0) with no distinguishing note —
-- inserted as "Silica Sand (1)" / "Silica Sand (2)" so they don't collide;
-- rename them once you know which grade is which.

create or replace function _norm(t text) returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(t, ''), '[^a-zA-Z0-9]', '', 'g'))
$$;

do $$
declare
  fid uuid;
  mat record;
begin
  -- =====================================================================
  -- GOMAX P10 Grey (1200kg batch)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('P10-GREY'), _norm('P10'))
     or (_norm(base_name) = _norm('P10') and _norm(variant) = _norm('Grey'))
     or _norm(name) = _norm('GOMAX P10 Grey')
  limit 1;

  if fid is null then
    insert into formulations (code, name, base_name, variant)
    values ('P10-GREY', 'GOMAX P10 Grey', 'P10', 'Grey')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('Grey Cement', 345.0),
    ('Silica Sand', 720.0),
    ('D 400', 145.0),
    ('ME 60,000', 1.7),
    ('Calcium Formate', 2.0),
    ('PP Fibre', 0.14)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX PURESET P40 - Grey (1200kg batch)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('P40-GREY'), _norm('PURESET-P40-GREY'))
     or (_norm(base_name) = _norm('P40') and _norm(variant) = _norm('Grey'))
     or _norm(name) = _norm('GOMAX PURESET P40 Grey')
  limit 1;

  if fid is null then
    insert into formulations (code, name, base_name, variant)
    values ('P40-GREY', 'GOMAX PURESET P40', 'P40', 'Grey')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('Grey Cement', 300.0),
    ('Silica Sand', 780.0),
    ('D 400', 120.0),
    ('ME 60,000', 2.2),
    ('Calcium Formate', 2.0),
    ('E 5010', 5.0),
    ('PP Fibre', 0.14)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX PURESET P40 - White (1200kg batch)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('P40-WHITE'), _norm('PURESET-P40-WHITE'))
     or (_norm(base_name) = _norm('P40') and _norm(variant) = _norm('White'))
     or _norm(name) = _norm('GOMAX PURESET P40 White')
  limit 1;

  if fid is null then
    insert into formulations (code, name, base_name, variant)
    values ('P40-WHITE', 'GOMAX PURESET P40', 'P40', 'White')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('White Cement', 350.0),
    ('Silica Sand', 550.0),
    ('D 400', 294.0),
    ('ME 60,000', 1.64),
    ('Calcium Formate', 2.0),
    ('E 5010', 2.4),
    ('PP Fibre', 0.14)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX PURESET IS100 - Grey (1200kg batch)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('IS100-GREY'), _norm('PURESET-IS100-GREY'))
     or (_norm(base_name) = _norm('IS100') and _norm(variant) = _norm('Grey'))
     or _norm(name) = _norm('GOMAX PURESET IS100 Grey')
  limit 1;

  if fid is null then
    insert into formulations (code, name, base_name, variant)
    values ('IS100-GREY', 'GOMAX PURESET IS100', 'IS100', 'Grey')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('Grey Cement', 366.0),
    ('Silica Sand', 700.0),
    ('D 400', 120.0),
    ('ME 60,000', 3.2),
    ('E 5044', 3.5),
    ('E 5010', 5.8),
    ('PP Fibre', 1.0),
    ('FD 40', 0.8)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX PURESET IS100 - White (1200kg batch)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('IS100-WHITE'), _norm('PURESET-IS100-WHITE'))
     or (_norm(base_name) = _norm('IS100') and _norm(variant) = _norm('White'))
     or _norm(name) = _norm('GOMAX PURESET IS100 White')
  limit 1;

  if fid is null then
    insert into formulations (code, name, base_name, variant)
    values ('IS100-WHITE', 'GOMAX PURESET IS100', 'IS100', 'White')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('White Cement', 360.0),
    ('Silica Sand', 700.0),
    ('D 400', 120.0),
    ('ME 60,000', 3.2),
    ('E 5044', 3.5),
    ('E 5010', 13.0),
    ('FD 40', 0.8),
    ('PP Fibre', 3.5)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX P100 - Grey (1200kg batch)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('P100-GREY'), _norm('P100'))
     or (_norm(base_name) = _norm('P100') and _norm(variant) = _norm('Grey'))
     or _norm(name) = _norm('GOMAX P100 Grey')
  limit 1;

  if fid is null then
    insert into formulations (code, name, base_name, variant)
    values ('P100-GREY', 'GOMAX P100', 'P100', 'Grey')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('Grey Cement', 480.0),
    ('Silica Sand', 646.0),
    ('D 400', 65.0),
    ('ME 60,000', 3.0),
    ('Calcium Formate', 4.8),
    ('E 5010', 12.0),
    ('PP Fibre', 3.5),
    ('E 5044', 3.5),
    ('FD 40', 1.2)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX P100 - White (1200kg batch)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('P100-WHITE'))
     or (_norm(base_name) = _norm('P100') and _norm(variant) = _norm('White'))
     or _norm(name) = _norm('GOMAX P100 White')
  limit 1;

  if fid is null then
    insert into formulations (code, name, base_name, variant)
    values ('P100-WHITE', 'GOMAX P100', 'P100', 'White')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('White Cement', 480.0),
    ('Silica Sand', 646.0),
    ('D 400', 62.0),
    ('ME 60,000', 3.0),
    ('Calcium Formate', 4.8),
    ('E 5010', 15.0),
    ('FD 40', 1.2),
    ('PP Fibre', 3.5),
    ('E 5044', 3.5)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX ULTRA - Grey (1200kg batch)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('ULTRA-GREY'))
     or (_norm(base_name) = _norm('ULTRA') and _norm(variant) = _norm('Grey'))
     or _norm(name) = _norm('GOMAX ULTRA Grey')
  limit 1;

  if fid is null then
    insert into formulations (code, name, base_name, variant)
    values ('ULTRA-GREY', 'GOMAX ULTRA', 'ULTRA', 'Grey')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('Grey Cement', 480.0),
    ('Silica Sand', 580.0),
    ('D 400', 80.0),
    ('ME 60,000', 4.8),
    ('Calcium Formate', 7.2),
    ('E 5010', 22.5),
    ('FD 40', 3.0),
    ('PP Fibre', 2.4),
    ('E 5044', 20.7)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX ULTRA - White (1200kg batch)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('ULTRA-WHITE'))
     or (_norm(base_name) = _norm('ULTRA') and _norm(variant) = _norm('White'))
     or _norm(name) = _norm('GOMAX ULTRA White')
  limit 1;

  if fid is null then
    insert into formulations (code, name, base_name, variant)
    values ('ULTRA-WHITE', 'GOMAX ULTRA', 'ULTRA', 'White')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('White Cement', 480.0),
    ('Silica Sand', 580.0),
    ('D 400', 80.0),
    ('ME 60,000', 4.8),
    ('Calcium Formate', 7.2),
    ('E 5010', 22.5),
    ('FD 40', 3.0),
    ('PP Fibre', 2.4),
    ('E 5044', 20.7)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX ROCKCRETE 280 (1000kg batch, standalone — no Grey/White split)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('ROCKCRETE-280'), _norm('ROCKCRETE280'))
     or _norm(name) = _norm('GOMAX ROCKCRETE 280')
  limit 1;

  if fid is null then
    insert into formulations (code, name)
    values ('ROCKCRETE-280', 'GOMAX ROCKCRETE 280')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('Grey Cement', 550.0),
    ('Silica Sand', 394.0),
    ('Micro Silica', 50.0),
    ('SNFC', 10.0)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX GROUT 2 (1000kg batch, standalone). Source table has two
  -- separate "Silica Sand" lines with no distinguishing label — kept as
  -- two rows so no data is dropped; rename once the grades are known.
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('GROUT-2'), _norm('GROUT2'))
     or _norm(name) = _norm('GOMAX GROUT 2')
  limit 1;

  if fid is null then
    insert into formulations (code, name)
    values ('GROUT-2', 'GOMAX GROUT 2')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('Grey Cement', 620.0),
    ('Silica Sand (1)', 250.0),
    ('SNFC', 4.0),
    ('Silica Sand (2)', 130.0)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

  -- =====================================================================
  -- GOMAX SUPFLOOR 100 (1200kg batch, standalone)
  -- =====================================================================
  select id into fid from formulations
  where _norm(code) in (_norm('SUPFLOOR-100'), _norm('SUPFLOOR100'))
     or _norm(name) = _norm('GOMAX SUPFLOOR 100')
  limit 1;

  if fid is null then
    insert into formulations (code, name)
    values ('SUPFLOOR-100', 'GOMAX SUPFLOOR 100')
    returning id into fid;
  end if;

  for mat in select * from (values
    ('Grey Cement', 463.0),
    ('Silica Sand 16/32', 765.0),
    ('PC : WR', 2.0)
  ) as t(description, qty)
  loop
    update formulation_materials set standard_quantity = mat.qty
    where formulation_id = fid and _norm(description) = _norm(mat.description);
    if not found then
      insert into formulation_materials (formulation_id, description, standard_quantity, sort_order)
      values (fid, mat.description, mat.qty, (select coalesce(max(sort_order), 0) + 1 from formulation_materials where formulation_id = fid));
    end if;
  end loop;

end $$;

drop function _norm(text);
