import type { FoodEntry, Goal, Meal } from "./types";

export const CARB_RANGE: [number, number] = [45, 65]; // usual share of calories
export const FAT_RANGE: [number, number] = [20, 35];
export const OZ_TO_G = 28.3495;

export interface Totals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function totalsOf(entries: FoodEntry[]): Totals {
  return entries.reduce(
    (t, e) => ({
      calories: t.calories + e.calories,
      protein: t.protein + e.protein_g,
      carbs: t.carbs + e.carbs_g,
      fat: t.fat + e.fat_g
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

/** Share of calories from carbs and fat, in whole percent. 0 when nothing is logged. */
export function shares(t: Totals): { carbsPct: number; fatPct: number } {
  if (t.calories <= 0) return { carbsPct: 0, fatPct: 0 };
  return {
    carbsPct: Math.round(((t.carbs * 4) / t.calories) * 100),
    fatPct: Math.round(((t.fat * 9) / t.calories) * 100)
  };
}

/** Numbers for an amount of food, from values per 100 g. */
export function scale(per100: { calories: number; protein: number; carbs: number; fat: number }, grams: number) {
  const f = grams / 100;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { calories: Math.round(per100.calories * f), protein: r1(per100.protein * f), carbs: r1(per100.carbs * f), fat: r1(per100.fat * f) };
}

/** Rough starting numbers from body weight and goal. General estimates only. */
export function suggestNutrition(kg: number, goal: Goal | null): { calories: number; protein: number } {
  const proteinPerKg = goal === "lose_fat" ? 2.0 : goal === "stay_fit" ? 1.4 : 1.8;
  const maintenance = kg * 33;
  const factor = goal === "build_muscle" ? 1.1 : goal === "lose_fat" ? 0.8 : 1;
  return { calories: Math.round((maintenance * factor) / 50) * 50, protein: Math.round(proteinPerKg * kg) };
}

/** Which meal it probably is, from the time of day. */
export function defaultMeal(now: Date = new Date()): Meal {
  const h = now.getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 17) return "snack";
  if (h < 21) return "dinner";
  return "snack";
}
