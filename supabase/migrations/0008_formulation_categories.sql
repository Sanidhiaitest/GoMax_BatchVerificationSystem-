-- Categorize the initial formulation set for the supervisor app's
-- category tabs. Grout: Rockcrete 280, Grout 2, Supfloor 100. Everything
-- else currently in the catalog is Adhesives. (Epoxy has no formulations
-- yet — it'll appear as a tab automatically once one is tagged with it.)

update formulations
set category = 'Grout'
where code in ('ROCKCRETE-280', 'GROUT-2', 'SUPFLOOR-100');

update formulations
set category = 'Adhesives'
where code not in ('ROCKCRETE-280', 'GROUT-2', 'SUPFLOOR-100');
