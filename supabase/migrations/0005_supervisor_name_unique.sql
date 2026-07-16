-- Guards against accidentally re-running an admin_create_supervisor batch
-- and silently ending up with duplicate active supervisors sharing a name
-- (which would split one person's batch history across two rows). A
-- partial unique index rather than a plain constraint so a supervisor can
-- be deactivated and a new active one later reuse the same name.
create unique index if not exists supervisors_active_name_unique
  on supervisors (name)
  where active;
