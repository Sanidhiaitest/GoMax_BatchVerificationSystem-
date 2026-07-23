// Supabase Edge Function: flag-batch
//
// Triggered (via the `batches_ai_flagging` DB trigger, see
// supabase/migrations/0004_ai_flagging_trigger.sql) whenever a batch is
// submitted. Reviews the batch against recent history for the same
// supervisor and the same formulation, and asks an LLM for soft,
// judgment-based flags that the deterministic rules (fast-tick, off-hours,
// duplicate batch number, missing items — all handled in SQL) would miss:
//
//   - a quantity unusually high/low vs. that formulation's normal range or
//     that supervisor's own history
//   - a supervisor's pattern over time looking off (always submits at
//     shift-end, consistently skips the same material, quantities cluster
//     near minimums)
//   - batch-to-batch inconsistency in how long the same formulation
//     normally takes start-to-finish
//
// Flags are written to batch_flags with source='ai' and a plain-language
// message so the dashboard can show "what looks off and why" at a glance.
//
// This function is invoked with the service role key (set as the
// `flag_batch_function_key` app_setting) so it can read/write across all
// batches regardless of RLS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5";

const HISTORY_LIMIT = 15;

interface FlagResult {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  let batchId: string | undefined;
  try {
    const payload = await req.json();
    // Supports both a direct { batch_id } call and a Supabase Database
    // Webhook payload shaped like { record: { id } }.
    batchId = payload.batch_id ?? payload.record?.id;
  } catch {
    return jsonResponse({ error: "invalid json body" }, 400);
  }

  if (!batchId) {
    return jsonResponse({ error: "batch_id is required" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select(
      "id, batch_number, batch_date, mason_name, status, started_at, submitted_at, formulation_id, supervisor_id, formulations(code, name), supervisors!batches_supervisor_id_fkey(name)",
    )
    .eq("id", batchId)
    .single();

  if (batchError || !batch) {
    return jsonResponse({ error: `batch not found: ${batchError?.message}` }, 404);
  }

  if (batch.status !== "submitted") {
    return jsonResponse({ skipped: true, reason: "batch not submitted yet" });
  }

  const { data: materials, error: materialsError } = await supabase
    .from("batch_materials")
    .select("description, status, quantity, ticked_at, sort_order")
    .eq("batch_id", batchId)
    .order("sort_order");

  if (materialsError) {
    return jsonResponse({ error: materialsError.message }, 500);
  }

  // Recent history for this supervisor (any formulation) and for this
  // formulation (any supervisor), for pattern comparison.
  const [{ data: supervisorHistory }, { data: formulationHistory }] = await Promise.all([
    supabase
      .from("batches")
      .select(
        "id, batch_number, batch_date, started_at, submitted_at, formulations(code), batch_materials(description, status, quantity)",
      )
      .eq("supervisor_id", batch.supervisor_id)
      .eq("status", "submitted")
      .neq("id", batchId)
      .order("submitted_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("batches")
      .select("id, batch_number, batch_date, started_at, submitted_at, batch_materials(description, status, quantity)")
      .eq("formulation_id", batch.formulation_id)
      .eq("status", "submitted")
      .neq("id", batchId)
      .order("submitted_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const durationMinutes = batch.started_at && batch.submitted_at
    ? (new Date(batch.submitted_at).getTime() - new Date(batch.started_at).getTime()) / 60000
    : null;

  const formulationCode = (batch as any).formulations?.code ?? "unknown";
  const supervisorName = (batch as any).supervisors?.name ?? "unknown";

  const summarizeHistory = (rows: any[] | null) =>
    (rows ?? []).map((r) => ({
      batch_number: r.batch_number,
      batch_date: r.batch_date,
      duration_minutes: r.started_at && r.submitted_at
        ? Math.round(((new Date(r.submitted_at).getTime() - new Date(r.started_at).getTime()) / 60000) * 10) / 10
        : null,
      materials: (r.batch_materials ?? []).map((m: any) => ({
        description: m.description,
        status: m.status,
        quantity: m.quantity,
      })),
    }));

  const prompt = `You are a quality-control reviewer for a construction materials mixing plant. Review the batch below for soft, judgment-based anomalies that fixed rules would miss. Deterministic checks (too-fast ticking, off-hours submission, duplicate batch numbers, missing items) are already handled separately — do NOT repeat those, focus only on judgment calls like:
- a quantity that is unusually high/low vs. this formulation's normal range or this supervisor's own history
- a supervisor pattern that looks off over time (always submits right at shift-end, consistently skips the same material, quantities that cluster suspiciously close to minimums)
- batch-to-batch inconsistency for the same formulation code (e.g. this batch took a fraction of the usual start-to-finish time)

Current batch:
${JSON.stringify(
  {
    formulation_code: formulationCode,
    supervisor: supervisorName,
    batch_number: batch.batch_number,
    batch_date: batch.batch_date,
    mason_name: batch.mason_name,
    duration_minutes: durationMinutes !== null ? Math.round(durationMinutes * 10) / 10 : null,
    materials,
  },
  null,
  2,
)}

This supervisor's recent submitted batches (any formulation), most recent first:
${JSON.stringify(summarizeHistory(supervisorHistory), null, 2)}

Recent submitted batches for formulation ${formulationCode} (any supervisor), most recent first:
${JSON.stringify(summarizeHistory(formulationHistory), null, 2)}

Respond with ONLY a JSON array (no prose, no markdown fences) of flags to raise. Each element must be: {"severity": "info"|"warning"|"critical", "code": "short_snake_case_code", "message": "ONE short, crisp phrase — 10 words or fewer, plant-floor plain language, no filler words, state only what looks off (not why or what to do about it). Someone skimming a phone screen must get it in under a second. Example good message: 'SNFC added but quantity is 0'. Example bad message: a full sentence explaining the reasoning."}. If nothing looks unusual, respond with an empty array: [].`;

  let flags: FlagResult[] = [];
  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      throw new Error(`Anthropic API error ${aiResponse.status}: ${text}`);
    }

    const aiJson = await aiResponse.json();
    const textBlock = aiJson.content?.find((b: any) => b.type === "text")?.text ?? "[]";
    const cleaned = textBlock.trim().replace(/^```json\s*|```$/g, "");
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      flags = parsed.filter(
        (f) => f && typeof f.message === "string" && ["info", "warning", "critical"].includes(f.severity),
      );
    }
  } catch (err) {
    // Don't fail the whole request if the LLM call/parse breaks — log a
    // single diagnostic flag so it's visible on the dashboard instead of
    // silently vanishing.
    console.error("AI flagging failed:", err);
    flags = [
      {
        severity: "info",
        code: "ai_flagging_error",
        message: `AI review could not complete for this batch: ${(err as Error).message}`,
      },
    ];
  }

  if (flags.length > 0) {
    const { error: insertError } = await supabase.from("batch_flags").insert(
      flags.map((f) => ({
        batch_id: batchId,
        source: "ai",
        severity: f.severity,
        code: f.code ?? "ai_review",
        message: f.message,
      })),
    );
    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
    }
  }

  return jsonResponse({ ok: true, flags_written: flags.length });
});
