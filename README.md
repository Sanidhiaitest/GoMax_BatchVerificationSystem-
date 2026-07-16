# GoMax Batch Verification System

Two apps, one Supabase backend, for verifying that mixing-station batches are
built to formulation with a tamper-evident audit trail.

- **`apps/supervisor-app`** — installable PWA the plant supervisors use on
  their phones at the mixing station to log a batch as it's built.
- **`apps/admin-dashboard`** — mobile-first web dashboard Sharad, Shivansh and
  Ravinder ji use to review submissions, flags, and edit the master
  formulation list.
- **`supabase/`** — the shared backend: Postgres schema, RLS policies, RPC
  functions, and the AI flagging edge function.

## Why it's built this way

All the rules that actually matter for trust in the audit trail live in the
database, not the frontend, so they can't be bypassed by editing the app:

- **Server timestamps only.** Every write path (`start_batch`,
  `tick_material`, `submit_batch`) uses Postgres `now()`. No RPC accepts a
  client-supplied timestamp.
- **Immutable submitted batches.** Once `submit_batch()` runs, triggers on
  `batches`/`batch_materials`/`batch_flags` reject any further `UPDATE` or
  `DELETE` at the database level — independent of whatever the RPCs
  themselves do.
- **Batch numbers unique per day.** `batches` has a real unique constraint on
  `(batch_number, batch_date)`, not just a UI check.
- **PIN identity, not free text.** Supervisors are matched by a bcrypt-hashed
  4-digit PIN (`login_supervisor_pin`); the client never gets to say "I am
  X".
- **Minimum tick gap enforced server-side.** `tick_material()` computes the
  gap from the previous tick's server timestamp itself. A fast tick is never
  blocked — it's marked `suspicious` and flagged for the dashboard, per spec.
- **All writes go through `SECURITY DEFINER` RPCs.** Row Level Security
  denies direct client inserts/updates on `batches`, `batch_materials`, and
  `batch_flags` entirely, so the only way to write is through the RPCs above.

See `supabase/migrations/0001_init.sql` → `0004_ai_flagging_trigger.sql` for
the full schema, in order.

## One-time setup

### 1. Create the Supabase project

Create a project at [supabase.com](https://supabase.com) (reuse the same
account/org as the Kissa app if you want everything in one place).

Install the Supabase CLI, then link and push the schema:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations/*.sql in order
```

### 2. Enable anonymous sign-ins

The supervisor PWA authenticates the *device* anonymously, then maps that
device session to a supervisor via PIN (`login_supervisor_pin`). Turn this on
in **Authentication → Providers → Anonymous Sign-Ins** in the Supabase
dashboard (local dev already has it on via `supabase/config.toml`).

### 3. Create the admin accounts

For each of Sharad, Shivansh, and Ravinder ji:

1. **Authentication → Users → Add user** — create them with an email +
   password (or send a magic link, whichever you prefer for the dashboard
   login).
2. In the **SQL Editor**, promote them to a dashboard admin:

   ```sql
   insert into admin_users (auth_user_id, name)
   values ('<their auth user id, from the Users table>', 'Sharad');
   ```

   `admin_users` has no client-facing insert policy on purpose — this is a
   one-time bootstrap step done as the Supabase project owner, not something
   the apps can do to themselves.

### 4. Add supervisors and the master formulation list

Once at least one admin account exists, everything else can be done from the
admin dashboard itself:

- **Supervisors** tab → add each supervisor with a name and a 4-digit PIN.
- **Formulations** tab → add formulation codes (e.g. `P20`) and their
  material list. Editing a formulation's materials here updates every future
  supervisor checklist for that code immediately; in-progress and submitted
  batches keep the material snapshot they were started with.

(`supabase/seed.sql` has a sample `P20` formulation for local dev via
`supabase db reset` — it is not applied to a linked remote project by
`db push`, only migrations are.)

### 5. Deploy the AI flagging edge function

```bash
supabase functions deploy flag-batch
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5   # optional, this is the default
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically for
edge functions — nothing to set there.

### 6. Wire batch submission → the AI flagging function

`submit_batch()` fires a `pg_net` HTTP call (see
`supabase/migrations/0004_ai_flagging_trigger.sql`) whenever a batch's status
flips to `submitted`, but the function's URL and an auth key are
deployment-specific secrets and deliberately not hardcoded in the migration.
Set them once after deploying the function:

```sql
update app_settings set value = to_jsonb(
  'https://<project-ref>.functions.supabase.co/flag-batch'::text
) where key = 'flag_batch_function_url';

update app_settings set value = to_jsonb(
  '<service-role-key>'::text
) where key = 'flag_batch_function_key';
```

Until both are set, `submit_batch()` still works — it just skips the AI
review call (the hard-rule flags: fast-tick, off-hours, missing items,
duplicate batch numbers, are unaffected, since those are computed directly in
SQL, not by the LLM).

Other tunables live in the same `app_settings` table: `min_tick_gap_seconds`
(default 25), `shift_start_hour` / `shift_end_hour` (default 7/19, used for
the off-hours flag), and `plant_timezone` (default `Asia/Kolkata`).

### 7. Deploy both apps to Vercel

Each app is an independent Vercel project pointed at a subdirectory of this
repo:

| App | Vercel root directory | Suggested URL |
|---|---|---|
| Supervisor PWA | `apps/supervisor-app` | `gomax-qc.vercel.app` |
| Admin dashboard | `apps/admin-dashboard` | `gomax-qc-admin.vercel.app` |

For each project, set the environment variables (from **Project Settings →
API** in Supabase):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Build command `npm run build`, output directory `dist` (Vercel's Vite preset
detects both automatically once the root directory is set).

### 8. Distribute to supervisors

Send the supervisor app's URL once in the WhatsApp group (pin the message):

> Open this link, tap the share/menu icon, then "Add to Home Screen." After
> that, use the home screen icon — you won't need to open this link again.

## Local development

```bash
# backend (requires Docker for the local Supabase stack)
supabase start
supabase db reset   # applies migrations + supabase/seed.sql

# supervisor app
cd apps/supervisor-app
cp .env.example .env.local   # point at the local stack's URL/anon key (`supabase status`)
npm install
npm run dev

# admin dashboard
cd apps/admin-dashboard
cp .env.example .env.local
npm install
npm run dev
```

## What's intentionally out of scope for v1

Per spec: photo evidence of material/label at time of tick, and GPS
soft-logging. Both would slot into `tick_material()` / `batch_materials` as
additive columns without needing to change the immutability model.
