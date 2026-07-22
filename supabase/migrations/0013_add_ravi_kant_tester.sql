-- Second tester: Ravi Kant, alongside Varun. Both are plain 'tester' role
-- rows — no hierarchy between them. Whichever one starts testing a batch
-- claims it (existing start_testing/RLS behavior already makes a claimed
-- batch disappear from the other tester's queue automatically, since RLS
-- only shows 'pending' unclaimed batches or rows where tester_id = you).
-- Whoever completes it is recorded as tester_id, which the admin
-- dashboard already reads to show "tested by <name>".
insert into supervisors (name, pin_hash, role)
values ('Ravi Kant', crypt('6666', gen_salt('bf')), 'tester');
