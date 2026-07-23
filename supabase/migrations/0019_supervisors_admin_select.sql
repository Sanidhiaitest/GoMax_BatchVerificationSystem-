-- Bug fix: the admin dashboard's batch queries embed the supervisor and
-- tester name via `supervisors!batches_supervisor_id_fkey(name)` /
-- `supervisors!batches_tester_id_fkey(name)` — a PostgREST embed against
-- the raw `supervisors` table, not the `supervisors_public` view. Since
-- 0002_rls.sql deliberately left `supervisors` with no select policy at
-- all ("raw table is never selectable by clients"), every one of those
-- embeds has been silently returning null for admins too, which is why
-- batch cards on the dashboard show "by" with no name after it.
--
-- Fix: let admins select from the raw table. This doesn't newly expose
-- pin_hash — admins can already reset or deactivate any supervisor's PIN
-- via RPC, so they're already the trust boundary for this table, and the
-- dashboard's own queries only ever request the `name` column. Supervisor
-- and tester devices still have zero direct access, same as before.
create policy supervisors_admin_select on supervisors
  for select using (is_admin());
