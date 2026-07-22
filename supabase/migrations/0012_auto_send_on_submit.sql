-- Supervisors were expected to submit a batch AND then separately tap
-- "Send for Testing" — a second step people kept skipping, so batches sat
-- invisible to testers. Submitting a batch now sends it for testing in the
-- same transaction, automatically, no second action required.
create or replace function submit_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sup_id uuid := current_supervisor_id();
  b batches%rowtype;
  tz text := coalesce(get_setting_text('plant_timezone'), 'Asia/Kolkata');
  shift_start int := coalesce(get_setting_numeric('shift_start_hour'), 7)::int;
  shift_end int := coalesce(get_setting_numeric('shift_end_hour'), 19)::int;
  local_hour int;
  missing_count int;
  now_ts timestamptz := now();
begin
  select * into b from batches where id = p_batch_id;
  if not found then
    raise exception 'batch not found';
  end if;
  if b.supervisor_id <> sup_id then
    raise exception 'this batch does not belong to the logged-in supervisor';
  end if;
  if b.status <> 'in_progress' then
    raise exception 'batch is already submitted';
  end if;

  update batches
  set status = 'submitted',
      submitted_at = now_ts,
      testing_status = 'pending',
      sent_for_testing_at = now_ts
  where id = p_batch_id;

  select count(*) into missing_count
  from batch_materials
  where batch_id = p_batch_id and status = 'pending';

  if missing_count > 0 then
    insert into batch_flags (batch_id, source, severity, code, message)
    values (
      p_batch_id, 'rule', 'critical', 'missing_item',
      format('%s material(s) were submitted without being ticked or crossed.', missing_count)
    );
  end if;

  local_hour := extract(hour from (now_ts at time zone tz));
  if local_hour < shift_start or local_hour >= shift_end then
    insert into batch_flags (batch_id, source, severity, code, message)
    values (
      p_batch_id, 'rule', 'warning', 'off_hours',
      format('Batch was submitted at %s local time, outside the normal %s:00-%s:00 shift window.',
             to_char(now_ts at time zone tz, 'HH24:MI'), shift_start, shift_end)
    );
  end if;
end;
$$;
