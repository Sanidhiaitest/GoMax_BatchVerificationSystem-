-- One-time backfill: every batch that's already submitted but was never
-- sent for testing (because the "Send for Testing" action wasn't reachable
-- from the normal flow until this point) gets sent now, so Varun's queue
-- shows the full existing backlog immediately instead of only batches
-- submitted after this fix.
--
-- Safe to run more than once — it only ever touches rows still sitting at
-- testing_status = 'not_sent'.

update batches
set testing_status = 'pending',
    sent_for_testing_at = now()
where status = 'submitted'
  and testing_status = 'not_sent';
