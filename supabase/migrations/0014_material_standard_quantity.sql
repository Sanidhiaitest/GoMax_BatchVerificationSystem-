-- Formulation materials (the per-product template list) had no quantity
-- field at all — only batch_materials (the per-batch actual amount used,
-- entered live by a supervisor) did. That meant there was never anywhere
-- for the admin to set an expected/standard quantity per material, and
-- nothing to show supervisors as a reference while mixing.
alter table formulation_materials
  add column standard_quantity numeric;
