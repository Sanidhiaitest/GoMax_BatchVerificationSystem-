-- Stores the AI-generated "what's going on right now" summary shown on
-- the admin dashboard. A new row is appended each time the
-- dashboard-insight edge function actually calls the AI (it caches and
-- skips the call if the latest row is still fresh) — keeping history
-- costs nothing meaningful and means we never need an upsert dance.
create table dashboard_insights (
  id uuid primary key default gen_random_uuid(),
  summary text not null,
  generated_at timestamptz not null default now()
);

create index dashboard_insights_generated_at_idx on dashboard_insights (generated_at desc);

alter table dashboard_insights enable row level security;

-- Admins read through the normal client; the edge function itself uses
-- the service-role key and bypasses RLS to insert.
create policy dashboard_insights_select on dashboard_insights
  for select using (is_admin());
