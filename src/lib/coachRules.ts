import type { SessionWithSets } from "@/state/AppData";
import type { Exercise, Experience, FoodEntry, Profile } from "./types";
import { weekdayIndex } from "./types";
import { CARB_RANGE, FAT_RANGE, shares, totalsOf } from "./nutrition";
import { fmtWeight } from "./units";
import { parseDay } from "./format";

// ── Coach alerts: plain rules, no AI. Each one can be taken to the Coach chat. ──

export interface Alert {
  id: string;
  kind: "stall" | "consistency" | "protein" | "calories" | "carbs" | "fat";
  title: string;
  detail: string;
  /** What "Ask Coach" sends. */
  ask: string;
}

/** How many sessions without progress before Coach speaks up. Newer lifters progress fast, so sooner. */
export function stallThreshold(exp: Experience | null): number {
  switch (exp) {
    case "never":
    case "under_1":
      return 2;
    case "1_3":
      return 3;
    case "3_plus":
      return 4;
    default:
      return 3;
  }
}

function iso(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86400000);
}

interface Input {
  sessions: SessionWithSets[]; // newest first
  exerciseById: Map<string, Exercise>;
  profile: Profile | null;
  foodLog: FoodEntry[];
  now?: Date;
}

export function computeAlerts({ sessions, exerciseById, profile, foodLog, now = new Date() }: Input): Alert[] {
  const alerts: Alert[] = [];
  const today = iso(now);
  const unit = profile?.weight_unit ?? "kg";

  // 1. stalled lifts: the best set has not improved over the last few sessions
  const N = stallThreshold(profile?.experience ?? null);
  const scores = new Map<string, { date: string; score: number; top: { w: number | null; r: number | null; s: number | null } }[]>();
  sessions.forEach((s) => {
    const best = new Map<string, { score: number; top: { w: number | null; r: number | null; s: number | null } }>();
    s.sets.forEach((x) => {
      const ex = exerciseById.get(x.exercise_id);
      if (!ex) return;
      const score = ex.kind === "time" ? x.seconds ?? 0 : ex.kind === "bodyweight_reps" ? x.reps ?? 0 : (x.weight_kg ?? 0) * 1000 + (x.reps ?? 0);
      const cur = best.get(x.exercise_id);
      if (!cur || score > cur.score) best.set(x.exercise_id, { score, top: { w: x.weight_kg, r: x.reps, s: x.seconds } });
    });
    best.forEach((v, id) => scores.set(id, [...(scores.get(id) ?? []), { date: s.date, ...v }]));
  });
  const stalled: { ex: Exercise; date: string; top: { w: number | null; r: number | null; s: number | null } }[] = [];
  scores.forEach((list, id) => {
    const ex = exerciseById.get(id);
    if (!ex || list.length < N) return;
    const recent = list.slice(0, N); // newest first
    const newest = recent[0];
    const oldest = recent[N - 1];
    if (daysBetween(today, newest.date) > 21) return; // not training it lately
    if (newest.score <= oldest.score) stalled.push({ ex, date: newest.date, top: newest.top });
  });
  stalled
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3)
    .forEach(({ ex, top }) => {
      const what =
        ex.kind === "time" ? `${top.s ?? 0} sec` : ex.kind === "bodyweight_reps" ? `${top.r ?? 0} reps` : `${fmtWeight(top.w, unit)} × ${top.r ?? 0}`;
      alerts.push({
        id: `stall-${ex.id}`,
        kind: "stall",
        title: `${ex.name} hasn't moved in ${N} sessions`,
        detail: `Your best set has been about ${what}. A small jump, an extra rep, or a lighter week can get it moving.`,
        ask: `My ${ex.name} hasn't improved in ${N} sessions. What should I change?`
      });
    });

  // 2. consistency
  if (sessions.length > 0 && (profile?.workouts_per_week ?? 0) > 0) {
    const gap = daysBetween(today, sessions[0].date);
    const target = profile?.workouts_per_week ?? 3;
    if (gap >= 5) {
      alerts.push({
        id: "gap",
        kind: "consistency",
        title: `It's been ${gap} days since your last workout`,
        detail: "Even a shorter session keeps the habit going.",
        ask: "I've missed some workouts. How do I get back on track?"
      });
    } else {
      const idx = weekdayIndex(now);
      const monday = new Date(now);
      monday.setDate(now.getDate() - idx);
      const done = sessions.filter((s) => s.date >= iso(monday)).length;
      const expected = Math.floor((target * idx) / 7);
      if (done + 1 < expected) {
        alerts.push({
          id: "behind",
          kind: "consistency",
          title: "You're a little behind this week",
          detail: `${done} of ${target} workouts done so far.`,
          ask: `I'm behind on my workouts this week (${done} of ${target}). What's the best way to catch up?`
        });
      }
    }
  }

  // 3. nutrition: based on the last 3 finished days that have something logged
  const days: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(iso(d));
  }
  const logged = days.filter((d) => foodLog.some((f) => f.date === d));
  if (logged.length >= 2) {
    const t = totalsOf(foodLog.filter((f) => logged.includes(f.date)));
    const avg = { calories: t.calories / logged.length, protein: t.protein / logged.length, carbs: t.carbs / logged.length, fat: t.fat / logged.length };
    const span = `the last ${logged.length} days you logged`;
    const calTarget = profile?.calorie_target ?? null;
    const proTarget = profile?.protein_target_g ?? null;

    if (proTarget && avg.protein < proTarget * 0.85) {
      alerts.push({
        id: "protein",
        kind: "protein",
        title: "Protein is running low",
        detail: `About ${Math.round(avg.protein)} g a day over ${span}, against your ${proTarget} g goal.`,
        ask: `My protein has been about ${Math.round(avg.protein)} g a day against a goal of ${proTarget} g. How can I get it up?`
      });
    }
    if (calTarget) {
      const goal = profile?.goal;
      const over = avg.calories > calTarget * 1.15;
      const under = avg.calories < calTarget * 0.85;
      if ((goal === "lose_fat" && over) || (goal === "build_muscle" && under) || (goal !== "lose_fat" && goal !== "build_muscle" && (over || under))) {
        alerts.push({
          id: "calories",
          kind: "calories",
          title: over ? "Calories are above your goal" : "Calories are below your goal",
          detail: `About ${Math.round(avg.calories)} kcal a day over ${span}, against your ${calTarget} kcal goal.`,
          ask: `I've been averaging ${Math.round(avg.calories)} kcal a day against a goal of ${calTarget}. What should I do?`
        });
      }
    }
    const sh = shares({ calories: avg.calories, protein: avg.protein, carbs: avg.carbs, fat: avg.fat });
    if (avg.calories >= 500) {
      if (sh.carbsPct < CARB_RANGE[0] || sh.carbsPct > CARB_RANGE[1]) {
        alerts.push({
          id: "carbs",
          kind: "carbs",
          title: sh.carbsPct < CARB_RANGE[0] ? "Carbs are on the low side" : "Carbs are on the high side",
          detail: `${sh.carbsPct}% of your calories over ${span}. The usual range is ${CARB_RANGE[0]}–${CARB_RANGE[1]}%.`,
          ask: `About ${sh.carbsPct}% of my calories are from carbs. Is that a problem for my goal?`
        });
      }
      if (sh.fatPct < FAT_RANGE[0] || sh.fatPct > FAT_RANGE[1]) {
        alerts.push({
          id: "fat",
          kind: "fat",
          title: sh.fatPct < FAT_RANGE[0] ? "Fat is on the low side" : "Fat is on the high side",
          detail: `${sh.fatPct}% of your calories over ${span}. The usual range is ${FAT_RANGE[0]}–${FAT_RANGE[1]}%.`,
          ask: `About ${sh.fatPct}% of my calories are from fat. Is that a problem for my goal?`
        });
      }
    }
  }
  return alerts;
}
