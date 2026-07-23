-- Removes the duplicate "Ravi Kant" tester row(s). There's a unique index
-- on (name) where active, which should block an exact duplicate — so the
-- second row almost certainly differs by case or stray whitespace (e.g.
-- "Ravi Kant " vs "Ravi Kant") and slipped past it. Keeps the
-- earliest-created matching row active and deactivates the rest (not
-- deleted, so any batch already tested under that row keeps its history).
with dupes as (
  select id, row_number() over (
    partition by lower(trim(name))
    order by created_at asc
  ) as rn
  from supervisors
  where lower(trim(name)) = 'ravi kant' and active
)
update supervisors
set active = false
where id in (select id from dupes where rn > 1);

-- Confirm only one active "Ravi Kant" remains:
select id, name, active, created_at from supervisors where lower(trim(name)) = 'ravi kant';
