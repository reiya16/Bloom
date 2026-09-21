import type { WeightUnit } from "./types";

const LB_PER_KG = 2.2046226218;

/** Guess a sensible starting unit from the phone's language (US → lb). */
export function defaultUnit(): WeightUnit {
  try {
    const lang = (navigator.language || "").toLowerCase();
    if (lang === "en-us" || lang === "en-lr" || lang === "en-mm") return "lb";
  } catch {
    // ignore
  }
  return "kg";
}

/** kg (as stored) → number in the person's unit, rounded for display. */
export function kgToUnit(kg: number, unit: WeightUnit): number {
  const v = unit === "lb" ? kg * LB_PER_KG : kg;
  return Math.round(v * 10) / 10;
}

/** number the person typed (in their unit) → kg to store. */
export function unitToKg(value: number, unit: WeightUnit): number {
  const kg = unit === "lb" ? value / LB_PER_KG : value;
  return Math.round(kg * 1000) / 1000;
}

export function fmtWeight(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null) return "–";
  const v = kgToUnit(kg, unit);
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}`;
}

/** Just the number (no unit), for input boxes. */
export function weightNumber(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null) return "";
  const v = kgToUnit(kg, unit);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Smallest sensible jump when adding weight. */
export function weightStep(unit: WeightUnit): number {
  return unit === "lb" ? 5 : 2.5;
}
