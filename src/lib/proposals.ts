import { targetText } from "./suggest";
import type { Change } from "./types";

/** A change written in plain words, for the Apply card. */
export function describeChange(c: Change): string {
  switch (c.op) {
    case "set_target":
      return `${c.exercise} in ${c.workout}: ${targetText(c.sets ?? 3, c.reps ?? null, c.seconds ?? null)}`;
    case "add_exercise":
      return `Add ${c.exercise} to ${c.workout} (${targetText(c.sets ?? 3, c.reps ?? null, c.seconds ?? null)})`;
    case "remove_exercise":
      return `Remove ${c.exercise} from ${c.workout}`;
    case "set_nutrition": {
      const parts = [c.calories ? `${c.calories} kcal` : null, c.protein_g ? `${c.protein_g} g protein` : null].filter(Boolean);
      return `Daily goal: ${parts.join(", ")}`;
    }
    case "replace_plan":
      return `Replace your plan with ${c.workouts.length} ${c.workouts.length === 1 ? "workout" : "workouts"}: ${c.workouts.map((w) => w.name).join(", ")}`;
  }
}

/** Plain lines under a replace_plan change so the person can see what they're getting. */
export function planLines(c: Change): string[] {
  if (c.op !== "replace_plan") return [];
  return c.workouts.map((w) => `${w.name}: ${w.exercises.map((x) => x.exercise).join(", ")}`);
}
