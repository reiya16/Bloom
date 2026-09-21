import type {
  Equipment,
  Exercise,
  ExerciseEquipment,
  Experience,
  Goal,
  MuscleGroup,
  ScheduleMode
} from "./types";
import { muscleLabel } from "./types";

// ── Plan suggestions ─────────────────────────────────────────────────────────
// Simple, predictable rules (no AI): goal + days per week + experience decide the
// split, and the person's equipment decides which exercises are used.

export type TemplateId = "full_body" | "upper_lower" | "ppl" | "ppl_ul" | "body_part" | "custom";

export interface TemplateInfo {
  id: TemplateId;
  title: string;
}

/** The starting points shown under "Show me other options". */
export const TEMPLATE_OPTIONS: TemplateInfo[] = [
  { id: "ppl", title: "Push / Pull / Legs" },
  { id: "upper_lower", title: "Upper / Lower" },
  { id: "full_body", title: "Full body" },
  { id: "body_part", title: "One muscle group per day" },
  { id: "custom", title: "Build my own from scratch" }
];

export interface Slot {
  group: MuscleGroup;
  count: number;
}

export interface WorkoutSpec {
  name: string;
  slots: Slot[];
}

export interface PlannedItem {
  exercise: Exercise;
  sets: number;
  reps: number | null;
  seconds: number | null;
}

export interface PlannedWorkout {
  name: string;
  focus: string;
  items: PlannedItem[];
  weekdays: number[] | null;
}

export interface PlanDraft {
  templateId: TemplateId;
  title: string;
  why: string;
  workouts: PlannedWorkout[];
}

export interface PlanInputs {
  goal: Goal | null;
  experience: Experience | null;
  equipment: Equipment | null;
  workouts_per_week: number | null;
  schedule_mode: ScheduleMode;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function allowedEquipment(eq: Equipment | null): Set<ExerciseEquipment> {
  switch (eq) {
    case "home_dumbbells":
      return new Set<ExerciseEquipment>(["dumbbell", "bodyweight"]);
    case "bodyweight":
      return new Set<ExerciseEquipment>(["bodyweight"]);
    default:
      return new Set<ExerciseEquipment>(["gym", "dumbbell", "bodyweight"]);
  }
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const UPPER: Slot[][] = [
  [
    { group: "chest", count: 2 },
    { group: "back", count: 2 },
    { group: "shoulders", count: 1 },
    { group: "biceps", count: 1 },
    { group: "triceps", count: 1 }
  ],
  [
    { group: "back", count: 2 },
    { group: "chest", count: 1 },
    { group: "shoulders", count: 2 },
    { group: "biceps", count: 1 },
    { group: "triceps", count: 1 }
  ]
];
const LOWER: Slot[][] = [
  [
    { group: "quads", count: 2 },
    { group: "hamstrings", count: 1 },
    { group: "glutes", count: 1 },
    { group: "calves", count: 1 },
    { group: "core", count: 1 }
  ],
  [
    { group: "hamstrings", count: 2 },
    { group: "glutes", count: 1 },
    { group: "quads", count: 1 },
    { group: "calves", count: 1 },
    { group: "core", count: 1 }
  ]
];
const PUSH: Slot[] = [
  { group: "chest", count: 2 },
  { group: "shoulders", count: 2 },
  { group: "triceps", count: 2 }
];
const PULL: Slot[] = [
  { group: "back", count: 3 },
  { group: "biceps", count: 2 },
  { group: "core", count: 1 }
];
const LEGS: Slot[] = [
  { group: "quads", count: 2 },
  { group: "hamstrings", count: 2 },
  { group: "glutes", count: 1 },
  { group: "calves", count: 1 }
];
const FULL: Slot[] = [
  { group: "quads", count: 1 },
  { group: "hamstrings", count: 1 },
  { group: "chest", count: 1 },
  { group: "back", count: 1 },
  { group: "shoulders", count: 1 },
  { group: "core", count: 1 }
];

/** Names workouts like "Push" or "Push A / Push B" depending on how often a type repeats. */
function nameCycle(types: string[]): string[] {
  const total: Record<string, number> = {};
  types.forEach((t) => (total[t] = (total[t] ?? 0) + 1));
  const seen: Record<string, number> = {};
  return types.map((t) => {
    const i = seen[t] ?? 0;
    seen[t] = i + 1;
    return total[t] > 1 ? `${t} ${LETTERS[i]}` : t;
  });
}

export function templateSpecs(id: TemplateId, daysIn: number): WorkoutSpec[] {
  const days = clamp(Math.round(daysIn || 3), 1, 6);

  if (id === "full_body") {
    const names = nameCycle(Array.from({ length: days }, () => "Full body"));
    return names.map((name, i) => ({ name, slots: FULL }));
  }

  if (id === "upper_lower") {
    const types = Array.from({ length: days }, (_, i) => (i % 2 === 0 ? "Upper" : "Lower"));
    const names = nameCycle(types);
    const seen = { Upper: 0, Lower: 0 } as Record<string, number>;
    return types.map((t, i) => {
      const occ = seen[t]++;
      const pattern = (t === "Upper" ? UPPER : LOWER)[occ % 2];
      return { name: names[i], slots: pattern };
    });
  }

  if (id === "ppl") {
    const cycle = ["Push", "Pull", "Legs"];
    const types = Array.from({ length: days }, (_, i) => cycle[i % 3]);
    const names = nameCycle(types);
    const seen: Record<string, number> = {};
    return types.map((t, i) => {
      const occ = seen[t] ?? 0;
      seen[t] = occ + 1;
      return { name: names[i], slots: t === "Push" ? PUSH : t === "Pull" ? PULL : LEGS };
    });
  }

  if (id === "ppl_ul") {
    const specs: WorkoutSpec[] = [
      { name: "Push", slots: PUSH },
      { name: "Pull", slots: PULL },
      { name: "Legs", slots: LEGS },
      { name: "Upper", slots: UPPER[0] },
      { name: "Lower", slots: LOWER[0] }
    ];
    return specs.slice(0, days);
  }

  if (id === "body_part") {
    const all: WorkoutSpec[] = [
      { name: "Chest", slots: [{ group: "chest", count: 4 }] },
      { name: "Back", slots: [{ group: "back", count: 4 }] },
      {
        name: "Legs",
        slots: [
          { group: "quads", count: 2 },
          { group: "hamstrings", count: 2 },
          { group: "glutes", count: 1 },
          { group: "calves", count: 1 }
        ]
      },
      { name: "Shoulders", slots: [{ group: "shoulders", count: 4 }] },
      {
        name: "Arms",
        slots: [
          { group: "biceps", count: 3 },
          { group: "triceps", count: 3 },
          { group: "core", count: 1 }
        ]
      },
      {
        name: "Legs B",
        slots: [
          { group: "hamstrings", count: 2 },
          { group: "glutes", count: 2 },
          { group: "quads", count: 1 },
          { group: "core", count: 1 }
        ]
      }
    ];
    return all.slice(0, days);
  }

  // custom: empty workouts the person fills in themselves
  return Array.from({ length: days }, (_, i) => ({ name: `Workout ${LETTERS[i]}`, slots: [] }));
}

/** Picks exercises for one muscle group, easiest-to-recommend first. Exercises not yet used
 *  anywhere in the plan come first, so repeated workout types get different exercises. */
function pick(
  library: Exercise[],
  group: MuscleGroup,
  count: number,
  allowed: Set<ExerciseEquipment>,
  usedInWorkout: Set<string>,
  usedInPlan: Set<string>
): Exercise[] {
  const pool = library
    .filter(
      (e) =>
        e.user_id === null &&
        !e.archived &&
        e.muscle_group === group &&
        allowed.has(e.equipment) &&
        !usedInWorkout.has(e.id)
    )
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  const fresh = pool.filter((e) => !usedInPlan.has(e.id));
  const stale = pool.filter((e) => usedInPlan.has(e.id));
  const out = [...fresh, ...stale].slice(0, count);
  out.forEach((e) => {
    usedInWorkout.add(e.id);
    usedInPlan.add(e.id);
  });
  return out;
}

// Bodyweight moves that are hard for most beginners: aim for fewer reps.
const HARD_BODYWEIGHT = new Set([
  "pull-ups",
  "chin-ups",
  "chest-dips",
  "nordic-curl",
  "pike-push-ups",
  "hanging-knee-raise",
  "ab-wheel-rollout"
]);

export function targetsFor(
  ex: Pick<Exercise, "kind" | "priority" | "slug">,
  goal: Goal | null,
  exp: Experience | null
): { sets: number; reps: number | null; seconds: number | null } {
  if (ex.kind === "time") {
    const beginner = exp === "never" || exp === "under_1";
    return { sets: 3, reps: null, seconds: beginner ? 30 : 45 };
  }
  if (ex.kind === "bodyweight_reps" && ex.slug && HARD_BODYWEIGHT.has(ex.slug)) {
    return { sets: 3, reps: goal === "get_stronger" || goal === "build_muscle" ? 6 : 8, seconds: null };
  }
  const compound = ex.kind === "weight_reps" && ex.priority <= 16;
  switch (goal) {
    case "get_stronger":
      return compound ? { sets: 4, reps: 5, seconds: null } : { sets: 3, reps: 8, seconds: null };
    case "lose_fat":
      return { sets: 3, reps: 12, seconds: null };
    case "stay_fit":
      return { sets: 3, reps: 10, seconds: null };
    case "build_muscle":
    default:
      if (ex.kind === "bodyweight_reps") return { sets: 3, reps: 12, seconds: null };
      return compound ? { sets: 3, reps: 8, seconds: null } : { sets: 3, reps: 12, seconds: null };
  }
}

export function focusText(slots: Slot[]): string {
  const groups: MuscleGroup[] = [];
  slots.forEach((s) => {
    if (!groups.includes(s.group)) groups.push(s.group);
  });
  const labels: string[] = [];
  let armsDone = false;
  groups.forEach((g) => {
    if ((g === "biceps" || g === "triceps") && groups.includes("biceps") && groups.includes("triceps")) {
      if (!armsDone) {
        labels.push("arms");
        armsDone = true;
      }
      return;
    }
    labels.push(muscleLabel(g).toLowerCase());
  });
  if (labels.length === 0) return "You choose the exercises";
  const s = labels.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 0 = Monday. Spreads workouts across the week with rest days in between. */
export function spreadWeekdays(n: number): number[] {
  const table: Record<number, number[]> = {
    1: [0],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5]
  };
  return table[clamp(n, 1, 6)];
}

// ── choosing the split ───────────────────────────────────────────────────────

export interface Suggestion {
  templateId: TemplateId;
  why: string;
}

const GOAL_PHRASE: Record<Goal, string> = {
  build_muscle: "building muscle",
  get_stronger: "getting stronger",
  lose_fat: "losing body fat while keeping muscle",
  stay_fit: "staying fit and healthy"
};

export function suggestTemplate(
  p: Pick<PlanInputs, "goal" | "experience" | "workouts_per_week">
): Suggestion {
  const d = clamp(p.workouts_per_week ?? 3, 1, 6);
  const goalPhrase = p.goal ? GOAL_PHRASE[p.goal] : "your goal";
  const experienced = p.experience === "1_3" || p.experience === "3_plus";

  if (d <= 2) {
    return {
      templateId: "full_body",
      why: `With ${d} ${d === 1 ? "day" : "days"} a week, full-body workouts train every muscle each time, which suits ${goalPhrase}.`
    };
  }
  if (d === 3) {
    if (p.goal === "build_muscle" && experienced) {
      return {
        templateId: "ppl",
        why: "Three days lets each workout focus on one type of movement: push, pull, then legs."
      };
    }
    return {
      templateId: "full_body",
      why: `With 3 days a week, full-body workouts train every muscle each time, a simple and effective way to start on ${goalPhrase}.`
    };
  }
  if (d === 4) {
    return {
      templateId: "upper_lower",
      why:
        p.goal === "build_muscle"
          ? "With 4 days a week, it trains every muscle twice, a common way to build muscle."
          : `With 4 days a week, it trains every muscle twice, a balanced way to work on ${goalPhrase}.`
    };
  }
  if (d === 5) {
    return {
      templateId: "ppl_ul",
      why: "Five days: push, pull and legs, plus an upper and a lower day, so most muscles get trained twice."
    };
  }
  return {
    templateId: "ppl",
    why: "Six days: push, pull and legs, each twice a week, so every muscle gets trained twice."
  };
}

export function templateTitle(id: TemplateId, days: number): string {
  switch (id) {
    case "full_body":
      return "Full body";
    case "upper_lower":
      return "Upper / Lower";
    case "ppl":
      return "Push / Pull / Legs";
    case "ppl_ul":
      return "Push / Pull / Legs + Upper / Lower";
    case "body_part":
      return "One muscle group per day";
    default:
      return `Custom plan (${days} ${days === 1 ? "workout" : "workouts"})`;
  }
}

/** Builds real workouts (with exercises and targets) for a chosen template. */
export function buildPlan(
  templateId: TemplateId,
  p: PlanInputs,
  library: Exercise[],
  why?: string
): PlanDraft {
  const days = clamp(p.workouts_per_week ?? 3, 1, 6);
  const specs = templateSpecs(templateId, days);
  const allowed = allowedEquipment(p.equipment);
  const weekdays = p.schedule_mode === "fixed" ? spreadWeekdays(specs.length) : null;

  const usedInPlan = new Set<string>();
  const workouts: PlannedWorkout[] = specs.map((spec, i) => {
    const used = new Set<string>();
    const items: PlannedItem[] = [];
    spec.slots.forEach((slot) => {
      pick(library, slot.group, slot.count, allowed, used, usedInPlan).forEach((ex) => {
        const t = targetsFor(ex, p.goal, p.experience);
        items.push({ exercise: ex, sets: t.sets, reps: t.reps, seconds: t.seconds });
      });
    });
    return {
      name: spec.name,
      focus: focusText(spec.slots),
      items,
      weekdays: weekdays ? [weekdays[i]] : null
    };
  });

  return {
    templateId,
    title: templateTitle(templateId, specs.length),
    why: why ?? "",
    workouts
  };
}

/** Text like "3 × 8" or "3 × 45 sec" for a target. */
export function targetText(sets: number, reps: number | null, seconds: number | null): string {
  if (seconds) return `${sets} × ${seconds} sec`;
  if (reps) return `${sets} × ${reps}`;
  return `${sets} sets`;
}
