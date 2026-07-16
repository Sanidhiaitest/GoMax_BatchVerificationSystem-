-- Local dev / demo seed data only. Applied automatically by `supabase db reset`
-- for local development — never run against production, where formulations
-- and supervisors should be entered for real via the admin dashboard.

insert into formulations (code, name) values
  ('P20', 'Plaster Mix 20kg')
on conflict (code) do nothing;

insert into formulation_materials (formulation_id, description, sort_order)
select f.id, m.description, m.sort_order
from formulations f
cross join (values
  ('Cement (OPC 53)', 0),
  ('River sand', 1),
  ('Fly ash', 2),
  ('Plasticizer', 3),
  ('Water', 4)
) as m(description, sort_order)
where f.code = 'P20';
