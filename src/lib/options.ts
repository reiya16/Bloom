import type { Equipment, Experience, Goal, ScheduleMode } from "./types";

// Plain-language copy for the first-time setup screens.

export const GOAL_OPTIONS: { id: Goal; title: string; blurb: string }[] = [
  {
    id: "build_muscle",
    title: "Build muscle",
    blurb: "Bigger, more defined muscles. Often picked by people who want to look more muscular."
  },
  {
    id: "get_stronger",
    title: "Get stronger",
    blurb: "Lift heavier over time. Often picked by people who play sports or want to lift more."
  },
  {
    id: "lose_fat",
    title: "Lose body fat",
    blurb: "Keep your muscle as body fat comes down. Often picked by people who want to slim down."
  },
  {
    id: "stay_fit",
    title: "Stay fit and healthy",
    blurb: "Feel good and stay active. Often picked by busy people or those returning after a break."
  }
];

export const GOAL_TITLE: Record<Goal, string> = {
  build_muscle: "Build muscle",
  get_stronger: "Get stronger",
  lose_fat: "Lose body fat",
  stay_fit: "Stay fit and healthy"
};

export const EXPERIENCE_OPTIONS: { id: Experience; label: string }[] = [
  { id: "never", label: "Never lifted" },
  { id: "under_1", label: "Under 1 year" },
  { id: "1_3", label: "1–3 years" },
  { id: "3_plus", label: "3+ years" }
];

export const EQUIPMENT_OPTIONS: { id: Equipment; title: string; blurb: string }[] = [
  { id: "full_gym", title: "Full gym", blurb: "Machines, barbells and dumbbells." },
  { id: "home_dumbbells", title: "Dumbbells at home", blurb: "A pair or a set of dumbbells, maybe a bench." },
  { id: "bodyweight", title: "Bodyweight only", blurb: "No equipment. Push-ups, squats, planks and similar." },
  { id: "mix", title: "A mix", blurb: "Some days at the gym, some at home." }
];

export const SCHEDULE_OPTIONS: { id: ScheduleMode; title: string; blurb: string }[] = [
  { id: "fixed", title: "Fixed days", blurb: "Like Mon, Wed, Fri." },
  { id: "rotation", title: "Rotation", blurb: "Next workout in order." },
  { id: "flexible", title: "Flexible", blurb: "Any day, with a weekly target." }
];

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
