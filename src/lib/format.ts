import type { Exercise, SessionSet, WeightUnit } from "./types";
import { fmtWeight } from "./units";

/** "132.3 lb: 8, 8, 7" (same weight) or "135 lb × 6, 140 lb × 5" (different weights). */
export function describeSets(ex: Pick<Exercise, "kind">, sets: SessionSet[], unit: WeightUnit): string {
  if (sets.length === 0) return "";
  if (ex.kind === "time") return `${sets.map((s) => s.seconds ?? 0).join(", ")} sec`;
  if (ex.kind === "bodyweight_reps") return `${sets.map((s) => s.reps ?? 0).join(", ")} reps`;
  const weights = new Set(sets.map((s) => s.weight_kg));
  if (weights.size === 1) return `${fmtWeight(sets[0].weight_kg, unit)}: ${sets.map((s) => s.reps ?? 0).join(", ")}`;
  return sets.map((s) => `${fmtWeight(s.weight_kg, unit)} × ${s.reps ?? 0}`).join(", ");
}

/** "Mon 21 Sep" for a YYYY-MM-DD date, without the off-by-one-day timezone trap. */
export function dayLabel(iso: string, withYear = false): string {
  return parseDay(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {})
  });
}

export function monthLabel(iso: string): string {
  return parseDay(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** YYYY-MM-DD as a local date (new Date("2026-09-21") would be UTC and show the day before in the US). */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
