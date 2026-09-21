// supabase/functions/coach/index.ts
//
// Bloom's Coach. For each chat message it:
//   1. reads the person's own data (their login is passed through, so they can only ever see their own rows)
//   2. asks Gemini for a reply, plus an optional "proposal" (a plan change the person can Apply or ignore)
//   3. checks the proposal against the real plan and exercise list, so nothing invented reaches the app
//   4. saves both messages and returns Coach's reply
// Coach never changes anything itself. Changes only happen when the person taps Apply in the app.
//
// Secrets to set (Edge Functions -> Secrets):  GEMINI_API_KEY   (optional: GEMINI_MODEL)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
// "-latest" always points at Google's current Flash model, so it keeps working when old models are retired.
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
const GEMINI_BASE = Deno.env.get("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });

const LB_PER_KG = 2.2046226218;

// ── types ────────────────────────────────────────────────────────────────────
type Thread = "coach" | "plan_setup";
interface Ex { id: string; name: string; muscle_group: string; kind: string; equipment: string; user_id: string | null; archived: boolean }

// ── small helpers ────────────────────────────────────────────────────────────
function userIdFrom(auth: string): string | null {
  // The platform has already verified this token, and the database re-checks it on every query.
  try {
    const payload = auth.replace(/^Bearer\s+/i, "").split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

const clampInt = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!isFinite(n)) return undefined;
  return Math.max(lo, Math.min(hi, Math.round(n)));
};
const wt = (kg: number | null, unit: string) => (kg == null ? "" : `${Math.round((unit === "lb" ? kg * LB_PER_KG : kg) * 10) / 10}${unit}`);

// ── context: what Coach knows about this person ─────────────────────────────
async function loadContext(db: any, thread: Thread) {
  const [prof, exs, wks, ses, food, msgs] = await Promise.all([
    db.from("profiles").select("*").maybeSingle(),
    db.from("exercises").select("id,name,muscle_group,kind,equipment,user_id,archived"),
    db.from("workouts").select("id,name,sort_order,workout_exercises(exercise_id,target_sets,target_reps,target_seconds,archived,sort_order)").order("sort_order"),
    db.from("sessions").select("id,workout_name,date,session_sets(exercise_id,set_number,weight_kg,reps,seconds)").order("date", { ascending: false }).limit(12),
    db.from("food_log").select("date,calories,protein_g,carbs_g,fat_g").gte("date", new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10)),
    db.from("coach_messages").select("role,content,created_at").eq("thread", thread).order("created_at", { ascending: false }).limit(10)
  ]);
  for (const r of [prof, exs, wks, ses, food, msgs]) if (r.error) throw new Error(`Could not read your data: ${r.error.message}`);
  return {
    profile: prof.data as any,
    exercises: (exs.data ?? []) as Ex[],
    workouts: (wks.data ?? []) as any[],
    sessions: (ses.data ?? []) as any[],
    food: (food.data ?? []) as any[],
    history: ((msgs.data ?? []) as any[]).reverse()
  };
}

function buildContext(c: Awaited<ReturnType<typeof loadContext>>): string {
  const unit = c.profile?.weight_unit ?? "kg";
  const byId = new Map(c.exercises.map((e) => [e.id, e]));
  const p = c.profile;
  const lines: string[] = [];
  lines.push(
    `PERSON: goal=${p?.goal ?? "not set"}, experience=${p?.experience ?? "not set"}, equipment=${p?.equipment ?? "not set"}, ` +
      `workouts per week=${p?.workouts_per_week ?? "not set"}, schedule=${p?.schedule_mode ?? "rotation"}, weights shown in ${unit}`
  );
  lines.push(
    `NUTRITION TARGETS: ${p?.calorie_target ? p.calorie_target + " kcal" : "no calorie target"}, ${p?.protein_target_g ? p.protein_target_g + " g protein" : "no protein target"}`
  );

  lines.push("\nPLAN (workout names to use exactly):");
  if (c.workouts.length === 0) lines.push("- (no workouts yet)");
  for (const w of c.workouts) {
    const items = (w.workout_exercises ?? [])
      .filter((i: any) => !i.archived)
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((i: any) => {
        const e = byId.get(i.exercise_id);
        const t = i.target_seconds ? `${i.target_sets}x${i.target_seconds}s` : i.target_reps ? `${i.target_sets}x${i.target_reps}` : `${i.target_sets} sets`;
        return e ? `${e.name} ${t}` : "";
      })
      .filter(Boolean);
    lines.push(`- ${w.name}: ${items.join("; ") || "(empty)"}`);
  }

  lines.push("\nRECENT WORKOUTS (newest first; each exercise shows its sets as weight x reps):");
  if (c.sessions.length === 0) lines.push("- (nothing logged yet)");
  for (const s of c.sessions) {
    const groups = new Map<string, any[]>();
    (s.session_sets ?? [])
      .sort((a: any, b: any) => a.set_number - b.set_number)
      .forEach((x: any) => groups.set(x.exercise_id, [...(groups.get(x.exercise_id) ?? []), x]));
    const parts: string[] = [];
    groups.forEach((sets, id) => {
      const e = byId.get(id);
      if (!e) return;
      const txt = sets
        .map((x) => (e.kind === "time" ? `${x.seconds ?? 0}s` : e.kind === "bodyweight_reps" ? `${x.reps ?? 0}` : `${wt(x.weight_kg, unit)}x${x.reps ?? 0}`))
        .join(", ");
      parts.push(`${e.name} ${txt}`);
    });
    lines.push(`- ${s.date} ${s.workout_name}: ${parts.join("; ")}`);
  }

  // lifts whose best set has not improved over the last 3 workouts
  const flat: string[] = [];
  const perEx = new Map<string, number[]>();
  for (const s of c.sessions) {
    const best = new Map<string, number>();
    for (const x of s.session_sets ?? []) {
      const e = byId.get(x.exercise_id);
      if (!e) continue;
      const score = e.kind === "time" ? x.seconds ?? 0 : e.kind === "bodyweight_reps" ? x.reps ?? 0 : (x.weight_kg ?? 0) * 1000 + (x.reps ?? 0);
      best.set(x.exercise_id, Math.max(best.get(x.exercise_id) ?? 0, score));
    }
    best.forEach((v, id) => perEx.set(id, [...(perEx.get(id) ?? []), v])); // newest first
  }
  perEx.forEach((scores, id) => {
    if (scores.length >= 3 && scores[0] <= scores[2]) flat.push(byId.get(id)?.name ?? "");
  });
  lines.push(`\nSTALLED LIFTS (no improvement across the last 3 sessions): ${flat.filter(Boolean).join(", ") || "none"}`);

  const days = new Map<string, { cal: number; p: number; c: number; f: number }>();
  for (const f of c.food) {
    const d = days.get(f.date) ?? { cal: 0, p: 0, c: 0, f: 0 };
    d.cal += Number(f.calories);
    d.p += Number(f.protein_g);
    d.c += Number(f.carbs_g);
    d.f += Number(f.fat_g);
    days.set(f.date, d);
  }
  lines.push("\nFOOD LOG (last 7 days, totals per day):");
  if (days.size === 0) lines.push("- (nothing logged)");
  Array.from(days.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .forEach(([d, v]) => {
      const share = (kcal: number) => (v.cal > 0 ? Math.round((kcal / v.cal) * 100) : 0);
      lines.push(`- ${d}: ${Math.round(v.cal)} kcal, protein ${Math.round(v.p)} g, carbs ${Math.round(v.c)} g (${share(v.c * 4)}% of calories), fat ${Math.round(v.f)} g (${share(v.f * 9)}% of calories)`);
    });

  const groups = new Map<string, string[]>();
  c.exercises
    .filter((e) => !e.archived)
    .forEach((e) => groups.set(e.muscle_group, [...(groups.get(e.muscle_group) ?? []), `${e.name}${e.kind === "time" ? " (timed)" : ""} [${e.equipment}]`]));
  lines.push("\nEXERCISES (use these exact names; [gym]=needs a gym, [dumbbell]=dumbbells, [bodyweight]=no equipment):");
  groups.forEach((names, g) => lines.push(`${g}: ${names.join(", ")}`));
  return lines.join("\n");
}

const OPS = `"changes" is a list. Each item is ONE of:
 {"op":"set_target","workout":"<workout name>","exercise":"<exercise name>","sets":3,"reps":10}      (timed exercises use "seconds" instead of "reps")
 {"op":"add_exercise","workout":"<workout name>","exercise":"<exercise name>","sets":3,"reps":10}
 {"op":"remove_exercise","workout":"<workout name>","exercise":"<exercise name>"}
 {"op":"set_nutrition","calories":2400,"protein_g":150}      (either field may be left out)
 {"op":"replace_plan","workouts":[{"name":"Push","exercises":[{"exercise":"<exercise name>","sets":3,"reps":10}]}]}   (replaces the whole plan)`;

function systemPrompt(thread: Thread, context: string): string {
  const base = `You are Coach inside Bloom, a fitness and nutrition app. Talk like a warm, direct personal trainer.

RULES
- Use the data below and quote real numbers. If data is missing, say so plainly instead of guessing.
- Keep replies short (under about 120 words) unless asked for detail. Plain language, no jargon.
- You give general fitness guidance, not medical advice. For pain, injury, dizziness or a medical condition, suggest seeing a doctor or physio. Never encourage extreme dieting or suggest under 1200 kcal a day.
- You cannot change anything yourself. To suggest a change to the plan or nutrition targets, include a "proposal" and the person decides whether to tap Apply. Never say a change has been made.
- Use exact exercise names from EXERCISES and exact workout names from PLAN.
- Only propose when the person asks for a change, or a change clearly helps (for example a stalled lift). Otherwise "proposal" is null.

OUTPUT: reply with JSON only, in this shape:
{"reply":"<what you say>","proposal":null}
or
{"reply":"<what you say>","proposal":{"title":"<short title>","summary":"<one sentence why>","changes":[...]}}
${OPS}`;
  const setup = `
THIS CONVERSATION: the person is setting up Bloom for the first time and wants to describe their routine in their own words.
Read their days, muscle groups, exercises and equipment. If you have enough to draft a plan, reply with one short sentence and a proposal containing a single replace_plan change (workout names of their choosing, exercises from the EXERCISES list that match their equipment, sensible sets and reps for their goal). If something essential is missing, ask ONE short question and set proposal to null.`;
  return `${base}${thread === "plan_setup" ? setup : ""}\n\n----- DATA -----\n${context}`;
}

// ── check the proposal against reality ──────────────────────────────────────
interface Cleaned {
  proposal: { title: string; summary: string; changes: any[] } | null;
  notes: string[];
}

function cleanProposal(raw: any, c: Awaited<ReturnType<typeof loadContext>>): Cleaned {
  const notes: string[] = [];
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.changes)) return { proposal: null, notes };
  const exByName = new Map(c.exercises.filter((e) => !e.archived).map((e) => [e.name.toLowerCase(), e]));
  const wkByName = new Map(c.workouts.map((w: any) => [String(w.name).toLowerCase(), w]));
  const inWorkout = (w: any, e: Ex) => (w.workout_exercises ?? []).some((i: any) => !i.archived && i.exercise_id === e.id);
  const lookupEx = (name: unknown) => (typeof name === "string" ? exByName.get(name.trim().toLowerCase()) : undefined);
  const lookupWk = (name: unknown) => (typeof name === "string" ? wkByName.get(name.trim().toLowerCase()) : undefined);
  const target = (e: Ex, ch: any) => {
    const sets = clampInt(ch.sets, 1, 10);
    return e.kind === "time"
      ? { sets, seconds: clampInt(ch.seconds ?? ch.reps, 5, 300) }
      : { sets, reps: clampInt(ch.reps, 1, 50) };
  };
  const out: any[] = [];

  for (const ch of raw.changes.slice(0, 14)) {
    if (!ch || typeof ch !== "object") continue;
    if (ch.op === "set_target" || ch.op === "add_exercise" || ch.op === "remove_exercise") {
      const w = lookupWk(ch.workout);
      const e = lookupEx(ch.exercise);
      if (!w) { notes.push(`I left out a change because "${ch.workout}" isn't one of your workouts.`); continue; }
      if (!e) { notes.push(`I couldn't match "${ch.exercise}" to the exercise list, so I left it out.`); continue; }
      const present = inWorkout(w, e);
      if (ch.op === "add_exercise" && present) { notes.push(`${e.name} is already in ${w.name}.`); continue; }
      if (ch.op !== "add_exercise" && !present) { notes.push(`${e.name} isn't in ${w.name}, so I left that change out.`); continue; }
      out.push({ op: ch.op, workout: w.name, exercise: e.name, ...(ch.op === "remove_exercise" ? {} : target(e, ch)) });
    } else if (ch.op === "set_nutrition") {
      const calories = clampInt(ch.calories, 1200, 6000);
      const protein_g = clampInt(ch.protein_g, 30, 350);
      if (calories == null && protein_g == null) continue;
      out.push({ op: "set_nutrition", ...(calories != null ? { calories } : {}), ...(protein_g != null ? { protein_g } : {}) });
    } else if (ch.op === "replace_plan" && Array.isArray(ch.workouts)) {
      const workouts: any[] = [];
      for (const w of ch.workouts.slice(0, 7)) {
        const name = typeof w?.name === "string" ? w.name.trim().slice(0, 40) : "";
        if (!name || !Array.isArray(w.exercises)) continue;
        const seen = new Set<string>();
        const exercises: any[] = [];
        for (const x of w.exercises.slice(0, 12)) {
          const e = lookupEx(x?.exercise);
          if (!e) { if (x?.exercise) notes.push(`I couldn't match "${x.exercise}" to the exercise list, so I left it out.`); continue; }
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          exercises.push({ exercise: e.name, ...target(e, x) });
        }
        if (exercises.length > 0) workouts.push({ name, exercises });
      }
      if (workouts.length > 0) out.push({ op: "replace_plan", workouts });
    }
  }
  if (out.length === 0) return { proposal: null, notes };
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 70) : "Suggested changes";
  const summary = typeof raw.summary === "string" ? raw.summary.trim().slice(0, 300) : "";
  return { proposal: { title, summary, changes: out }, notes };
}

// ── talk to Gemini ──────────────────────────────────────────────────────────
async function askGemini(system: string, history: { role: string; content: string }[], message: string) {
  const contents = [
    ...history.map((m) => ({ role: m.role === "coach" ? "model" : "user", parts: [{ text: m.content }] })),
    { role: "user", parts: [{ text: message }] }
  ];
  const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY as string },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const msg = data?.error?.message ?? `status ${res.status}`;
    throw new Error(`Coach's AI service returned an error: ${msg}`);
  }
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? "").join("").trim();
  if (!text) throw new Error("Coach couldn't answer that one. Try asking it a different way.");
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.reply === "string") return parsed as { reply: string; proposal?: unknown };
  } catch {
    // not JSON: fall through and treat the text as a plain reply
  }
  return { reply: text, proposal: null };
}

// ── the request ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const auth = req.headers.get("Authorization");
  const userId = auth ? userIdFrom(auth) : null;
  if (!auth || !userId) return json({ error: "Please sign in again." }, 401);
  try {
    const body = await req.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const thread: Thread = body?.thread === "plan_setup" ? "plan_setup" : "coach";
    if (message.length < 1 || message.length > 1500) return json({ error: "Type a message (up to 1500 characters)." }, 400);
    if (!GEMINI_KEY) return json({ error: "Coach isn't set up yet (the Gemini key is missing)." }, 500);

    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const ctx = await loadContext(db, thread);
    const answer = await askGemini(systemPrompt(thread, buildContext(ctx)), ctx.history, message);
    const { proposal, notes } = cleanProposal(answer.proposal, ctx);

    let reply = answer.reply.trim().slice(0, 2000);
    if (notes.length > 0) reply += `\n\n(${Array.from(new Set(notes)).join(" ")})`;

    const now = Date.now();
    const { data, error } = await db
      .from("coach_messages")
      .insert([
        { user_id: userId, thread, role: "user", content: message, proposal: null, proposal_status: null, created_at: new Date(now).toISOString() },
        { user_id: userId, thread, role: "coach", content: reply, proposal, proposal_status: proposal ? "pending" : null, created_at: new Date(now + 1).toISOString() }
      ])
      .select("*");
    if (error) throw new Error(`Could not save the conversation: ${error.message ?? JSON.stringify(error)}`);
    const coachRow = (data ?? []).find((r: any) => r.role === "coach");
    return json({ message: coachRow });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Coach ran into a problem." }, 502);
  }
});
