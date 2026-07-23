-- Diagnostic only — run this first and read the result before touching
-- anything. There's a unique index on (name) where active, so two rows
-- both exactly "Ravi Kant" while both active shouldn't be possible; if
-- you're seeing it twice in the supervisor app, the two rows almost
-- certainly differ slightly (extra space, different case, or a second
-- insert with a near-identical name) or there's an inactive duplicate
-- created before the unique index applied.
select id, name, role, active, created_at
from supervisors
where lower(trim(name)) like '%ravi kant%'
order by created_at;

-- Once you can see the two (or more) rows above and know which id is the
-- one you actually want to keep, deactivate the other(s) — do NOT delete,
-- since a real delete could orphan any batches already tested under that
-- row. Replace <extra-row-id> with the id of the row you don't want, then
-- run this on its own:
--
-- update supervisors set active = false where id = '<extra-row-id>';
