import type { Profile, WorkoutWithItems } from "./types";
import { todayISO, weekdayIndex } from "./types";
import type { SessionWithSets } from "@/state/AppData";
import { WEEKDAY_LABELS } from "./options";

export interface TodayPlan {
  workout: WorkoutWithItems | null;
  isRestDay: boolean;
  /** For fixed schedules on a rest day: when the next workout is. */
  nextText: string | null;
}

/** Which workout to suggest today, based on the person's schedule style. */
export function planForToday(
  workouts: WorkoutWithItems[],
  sessions: SessionWithSets[],
  profile: Profile | null,
  now: Date = new Date()
): TodayPlan {
  if (workouts.length === 0) return { workout: null, isRestDay: false, nextText: null };
  const mode = profile?.schedule_mode ?? "rotation";

  if (mode === "fixed") {
    const today = weekdayIndex(now);
    const scheduled = workouts.find((w) => w.weekdays?.includes(today));
    if (scheduled) return { workout: scheduled, isRestDay: false, nextText: null };
    for (let i = 1; i <= 7; i++) {
      const d = (today + i) % 7;
      const w = workouts.find((x) => x.weekdays?.includes(d));
      if (w) return { workout: null, isRestDay: true, nextText: `${w.name} on ${WEEKDAY_LABELS[d]}` };
    }
    return { workout: null, isRestDay: true, nextText: null };
  }

  // rotation and flexible: the workout after the one you did last
  const last = sessions.find((s) => s.workout_id && workouts.some((w) => w.id === s.workout_id));
  if (!last) return { workout: workouts[0], isRestDay: false, nextText: null };
  const idx = workouts.findIndex((w) => w.id === last.workout_id);
  return { workout: workouts[(idx + 1) % workouts.length], isRestDay: false, nextText: null };
}

export interface WeekDay {
  label: string;
  dayNumber: number;
  iso: string;
  isToday: boolean;
  planned: boolean;
  done: boolean;
}

function iso(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday to Sunday of the current week, with what's planned and what's done. */
export function currentWeek(
  workouts: WorkoutWithItems[],
  sessions: SessionWithSets[],
  profile: Profile | null,
  now: Date = new Date()
): WeekDay[] {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - weekdayIndex(now));
  const doneDates = new Set(sessions.map((s) => s.date));
  const fixed = profile?.schedule_mode === "fixed";
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = iso(d);
    return {
      label: WEEKDAY_LABELS[i].charAt(0),
      dayNumber: d.getDate(),
      iso: key,
      isToday: key === todayISO(),
      planned: fixed ? workouts.some((w) => w.weekdays?.includes(i)) : false,
      done: doneDates.has(key)
    };
  });
}
