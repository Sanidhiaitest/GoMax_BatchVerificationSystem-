-- Testing photo evidence: the tester (Varun) uploads a photo of the tested
-- sample/result alongside the pass/fail decision and remarks. Mirrors the
-- existing audio-remark plumbing exactly — a nullable path column on
-- batches, a private storage bucket, and an extra parameter on
-- complete_testing — so nothing about the existing flow changes.

alter table batches
  add column test_photo_path text;

-- complete_testing gains an optional photo path. The previous 4-argument
-- signature is dropped first so a call doesn't become ambiguous between
-- the two overloads.
drop function if exists complete_testing(uuid, text, text, text);

create or replace function complete_testing(
  p_batch_id uuid,
  p_result text,
  p_remarks text,
  p_remarks_audio_path text default null,
  p_photo_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b batches%rowtype;
begin
  if p_result not in ('passed', 'failed') then
    raise exception 'result must be passed or failed';
  end if;

  select * into b from batches where id = p_batch_id;
  if not found then
    raise exception 'batch not found';
  end if;
  if b.testing_status <> 'in_progress' then
    raise exception 'testing was not started for this batch';
  end if;
  if b.tester_id <> current_supervisor_id() then
    raise exception 'only the tester who started this can complete it';
  end if;

  update batches
  set testing_status = p_result,
      testing_completed_at = now(),
      test_remarks = p_remarks,
      test_remarks_audio_path = p_remarks_audio_path,
      test_photo_path = p_photo_path
  where id = p_batch_id;
end;
$$;

-- Keep the immutability trigger in sync: test_photo_path is a testing-layer
-- field, so it must remain writable after a batch is submitted (the explicit
-- allow-list in forbid_batch_mutation only blocks the production columns, so
-- no change is needed there — this comment documents the intent).

-- ---------------------------------------------------------------------
-- Private storage bucket for the test photos. Same policy shape as
-- testing-audio: any logged-in device can upload, only admins and testers
-- can read it back (dashboard fetches a short-lived signed URL).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('testing-photos', 'testing-photos', false)
on conflict (id) do nothing;

drop policy if exists testing_photos_insert on storage.objects;
create policy testing_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'testing-photos' and current_supervisor_id() is not null);

drop policy if exists testing_photos_select on storage.objects;
create policy testing_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'testing-photos' and (is_admin() or is_tester()));
