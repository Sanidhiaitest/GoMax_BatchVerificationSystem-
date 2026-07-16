-- Lets the supervisor app group related formulations (e.g. "P100" in Grey
-- and White) under one entry with small variant pills instead of two
-- separate rows repeating the same name, and lets the formulation picker
-- be organized into category tabs (Adhesives, Grout, ...). All three are
-- plain admin-editable fields, not a rigid enum, since the product line
-- will keep changing.

alter table formulations
  add column category text,
  add column base_name text,
  add column variant text;

-- One-time backfill for the formulations already created under the
-- "<BASE>-GREY" / "<BASE>-WHITE" code convention. Admins can adjust or
-- clear these (and set category) from the dashboard afterward — this
-- just seeds sensible starting values instead of leaving everything
-- blank.
update formulations
set
  variant = case
    when code like '%-GREY' then 'Grey'
    when code like '%-WHITE' then 'White'
    else null
  end,
  base_name = case
    when code like '%-GREY' then left(code, length(code) - 5)
    when code like '%-WHITE' then left(code, length(code) - 6)
    else null
  end
where code like '%-GREY' or code like '%-WHITE';
