import { supabase } from "./supabase";
import type { CoachMessage, CoachThread, FoodHit, FoodState } from "./types";

/** Calls one of Bloom's server functions and turns any failure into a readable message. */
async function call<T>(name: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg: string | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") msg = (await ctx.json())?.error ?? null;
    } catch {
      // no readable body: use the fallback below
    }
    throw new Error(msg ?? fallback);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) throw new Error((data as { error: string }).error);
  return data as T;
}

export async function askCoach(message: string, thread: CoachThread): Promise<CoachMessage> {
  const res = await call<{ message: CoachMessage }>(
    "coach",
    { message, thread },
    "Couldn't reach Coach. It may not be set up yet, or you may be offline."
  );
  return res.message;
}

export async function searchFoods(query: string): Promise<FoodHit[]> {
  const res = await call<{ foods: FoodHit[] }>(
    "food-search",
    { query },
    "Food search isn't available right now. It may not be set up yet, or you may be offline."
  );
  return res.foods ?? [];
}

const STATE_WORDS = /\b(raw|uncooked|cooked|roasted|boiled|baked|grilled|fried|steamed|broiled|braised|stewed|toasted|microwaved)\b/gi;

/** The same food in its raw or cooked form, if the database has it. */
export async function findSibling(hit: FoodHit, want: Exclude<FoodState, "unknown">): Promise<FoodHit | null> {
  const base = hit.name.replace(STATE_WORDS, " ").replace(/[,\s]+/g, " ").trim();
  if (!base) return null;
  const words = base.toLowerCase().split(" ").slice(0, 2);
  const results = await searchFoods(`${base} ${want === "raw" ? "raw" : "cooked"}`);
  return (
    results.find((r) => r.state === want && r.brand === null && words.every((w) => r.name.toLowerCase().includes(w))) ?? null
  );
}
