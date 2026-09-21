// ── Shared types for Bloom ────────────────────────────────────────────────────

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core";

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "glutes", label: "Glutes" },
  { id: "calves", label: "Calves" },
  { id: "core", label: "Core" }
];

export function muscleLabel(id: MuscleGroup): string {
  return MUSCLE_GROUPS.find((m) => m.id === id)?.label ?? id;
}

export type Goal = "build_muscle" | "get_stronger" | "lose_fat" | "stay_fit";
export type Experience = "never" | "under_1" | "1_3" | "3_plus";
export type Equipment = "full_gym" | "home_dumbbells" | "bodyweight" | "mix";
export type ScheduleMode = "fixed" | "rotation" | "flexible";
export type WeightUnit = "kg" | "lb";

export interface Profile {
  user_id: string;
  goal: Goal | null;
  experience: Experience | null;
  equipment: Equipment | null;
  workouts_per_week: number | null;
  weight_unit: WeightUnit;
  schedule_mode: ScheduleMode;
  calorie_target: number | null;
  protein_target_g: number | null;
  body_weight_kg: number | null;
  onboarding_done: boolean;
}

export type ExerciseKind = "weight_reps" | "bodyweight_reps" | "time";
export type ExerciseEquipment = "gym" | "dumbbell" | "bodyweight";

export interface Exercise {
  id: string;
  user_id: string | null; // null = built in
  slug: string | null;
  name: string;
  muscle_group: MuscleGroup;
  kind: ExerciseKind;
  equipment: ExerciseEquipment;
  priority: number;
  archived: boolean;
}

export interface Workout {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  weekdays: number[] | null; // 0 = Monday ... 6 = Sunday
}

export interface PlanItem {
  id: string;
  workout_id: string;
  exercise_id: string;
  sort_order: number;
  target_sets: number;
  target_reps: number | null;
  target_seconds: number | null;
  optional: boolean;
  archived: boolean;
  exercise: Exercise;
}

export interface WorkoutWithItems extends Workout {
  items: PlanItem[]; // active (non archived) items only, in order
}

export interface Session {
  id: string;
  user_id: string;
  workout_id: string | null;
  workout_name: string;
  date: string; // YYYY-MM-DD
  finished_at: string | null;
}

export interface SessionSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  seconds: number | null;
  is_extra: boolean;
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7;
}
