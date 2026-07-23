// Supabase Edge Function: dashboard-insight
//
// Generates the short "AI Insights" summary shown at the top of the admin
// dashboard — a couple of plain-language sentences describing what's
// actually going on right now (what needs attention, what's running
// smoothly), read from the same batches data the dashboard itself shows.
//
// Caches its result in dashboard_insights: if the most recent row is
// still fresh (< CACHE_MINUTES old), returns it straight away with no AI
// call — the summary doesn't need to be regenerated every time someone
// opens the dashboard, only every so often as the floor's state changes.
//
// Callers must be an authenticated admin (checked via the caller's own
// JWT + the existing is_admin() RPC) so this can't be hit anonymously to
// rack up API calls.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5";

const CACHE_MINUTES = 20;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: isAdmin, error: adminCheckError } = await callerClient.rpc("is_admin");
  if (adminCheckError || !isAdmin) {
    return jsonResponse({ error: "admin only" }, 403);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: cached } = await supabase
    .from("dashboard_insights")
    .select("summary, generated_at")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    const ageMinutes = (Date.now() - new Date(cached.generated_at).getTime()) / 60000;
    if (ageMinutes < CACHE_MINUTES) {
      return jsonResponse({ summary: cached.summary, generated_at: cached.generated_at, cached: true });
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: batches, error: batchesError } = await supabase
    .from("batches")
    .select(
      "batch_number, batch_date, status, testing_status, started_at, submitted_at, formulations(code), supervisors!batches_supervisor_id_fkey(name), tester:supervisors!batches_tester_id_fkey(name), batch_flags(severity, message)",
    )
    .order("started_at", { ascending: false })
    .limit(200);

  if (batchesError) {
    return jsonResponse({ error: batchesError.message }, 500);
  }

  const rows = batches ?? [];
  const mixing = rows.filter((b: any) => b.status === "in_progress");
  const awaitingTest = rows.filter((b: any) => b.testing_status === "pending" || b.testing_status === "in_progress");
  const attention = rows.filter((b: any) => (b.batch_flags?.length ?? 0) > 0 || b.testing_status === "failed");
  const doneToday = rows.filter((b: any) => b.status === "submitted" && (b.submitted_at ?? "").slice(0, 10) === today);
  const failedToday = rows.filter((b: any) => b.testing_status === "failed" && (b.submitted_at ?? "").slice(0, 10) === today);

  const countBy = (list: any[], key: (b: any) => string | undefined) => {
    const counts: Record<string, number> = {};
    for (const b of list) {
      const k = key(b);
      if (!k) continue;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  };

  const summaryData = {
    mixing_now: mixing.length,
    awaiting_test: awaitingTest.length,
    needs_attention: attention.length,
    done_today: doneToday.length,
    failed_today: failedToday.length,
    attention_by_supervisor: countBy(attention, (b) => b.supervisors?.name),
    attention_by_product: countBy(attention, (b) => b.formulations?.code),
    recent_flag_messages: attention
      .flatMap((b: any) => (b.batch_flags ?? []).map((f: any) => f.message))
      .slice(0, 8),
  };

  const prompt = `You are summarizing a live factory dashboard for a plant manager at a construction materials mixing plant, in the style of a short "AI Insights" card — 1 to 2 plain-language sentences they can read in two seconds on their phone. Be specific (name products/people when the data supports it) and actionable when something needs attention; otherwise reassure them things are running smoothly. No markdown, no bullet points, no preamble like "Here's a summary" — just the sentences themselves.

Current dashboard data:
${JSON.stringify(summaryData, null, 2)}`;

  let summary: string;
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
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      throw new Error(`Anthropic API error ${aiResponse.status}: ${text}`);
    }

    const aiJson = await aiResponse.json();
    summary = (aiJson.content?.find((b: any) => b.type === "text")?.text ?? "").trim();
    if (!summary) throw new Error("empty response from model");
  } catch (err) {
    console.error("dashboard-insight AI call failed:", err);
    // Deterministic fallback so the card never shows an error to the
    // admin — just a plainer version of the same information.
    summary =
      attention.length > 0
        ? `${attention.length} batch${attention.length > 1 ? "es" : ""} need attention right now.`
        : `${mixing.length} mixing, ${awaitingTest.length} awaiting test — nothing needs attention right now.`;
  }

  const generatedAt = new Date().toISOString();
  await supabase.from("dashboard_insights").insert({ summary, generated_at: generatedAt });

  return jsonResponse({ summary, generated_at: generatedAt, cached: false });
});
