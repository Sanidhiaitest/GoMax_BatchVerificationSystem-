-- Wires batch submission to the AI flagging edge function (supabase/functions/flag-batch)
-- using pg_net for a fire-and-forget async HTTP call. The function URL and the
-- service-role key it needs are deployment-specific secrets, so they are not
-- hardcoded here — set them once after deploying with:
--
--   update app_settings set value = to_jsonb('https://<project-ref>.functions.supabase.co/flag-batch'::text)
--   where key = 'flag_batch_function_url';
--
--   update app_settings set value = to_jsonb('<service-role-key>'::text)
--   where key = 'flag_batch_function_key';
--
-- (see README.md "Wiring up the AI flagging function"). Until those are set,
-- the trigger no-ops instead of failing the submit_batch() transaction.

create extension if not exists pg_net;

insert into app_settings (key, value) values
  ('flag_batch_function_url', 'null'),
  ('flag_batch_function_key', 'null')
on conflict (key) do nothing;

create or replace function trigger_ai_flagging()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn_url text := get_setting_text('flag_batch_function_url');
  fn_key text := get_setting_text('flag_batch_function_key');
begin
  if new.status = 'submitted' and (old.status is distinct from 'submitted')
     and fn_url is not null and fn_key is not null then
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || fn_key
      ),
      body := jsonb_build_object('batch_id', new.id)
    );
  end if;
  return new;
end;
$$;

-- Runs AFTER the immutability trigger from 0002 (which is also a BEFORE
-- UPDATE trigger) has allowed the transition through; AFTER UPDATE so it
-- only fires once the row is durably committed to this statement.
create trigger batches_ai_flagging
  after update on batches
  for each row execute function trigger_ai_flagging();
