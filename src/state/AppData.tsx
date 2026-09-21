import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Change,
  Exercise,
  FoodEntry,
  ExerciseEquipment,
  ExerciseKind,
  MuscleGroup,
  PlanItem,
  Profile,
  Proposal,
  ScheduleMode,
  Session,
  SessionSet,
  WorkoutWithItems
} from "@/lib/types";
import { targetsFor, type PlanDraft, type PlannedWorkout } from "@/lib/suggest";

export interface SessionWithSets extends Session {
  sets: SessionSet[];
}

export interface NewSessionSet {
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  seconds: number | null;
  is_extra: boolean;
}

export type NewFood = Omit<FoodEntry, "id" | "user_id">;

export interface NewExercise {
  name: string;
  muscle_group: MuscleGroup;
  kind: ExerciseKind;
  equipment: ExerciseEquipment;
}

interface AppData {
  userId: string;
  loading: boolean;
  loadError: string | null;
  profile: Profile | null;
  exercises: Exercise[];
  exerciseById: Map<string, Exercise>;
  workouts: WorkoutWithItems[];
  sessions: SessionWithSets[];
  /** The most recent logged sets for each exercise (for "last time"). */
  lastSets: Map<string, SessionSet[]>;
  /** Food eaten in the last ~5 weeks, newest first. */
  foodLog: FoodEntry[];
  addFood: (entry: NewFood) => Promise<void>;
  deleteFood: (id: string) => Promise<void>;
  /** Applies a Coach proposal. Only ever called when the person taps Apply. */
  applyProposal: (p: Proposal) => Promise<{ applied: string[]; skipped: string[] }>;
  refresh: () => Promise<void>;
  saveProfile: (patch: Partial<Omit<Profile, "user_id">>) => Promise<void>;
  createPlanFromDraft: (draft: PlanDraft) => Promise<void>;
  addWorkout: (name: string) => Promise<void>;
  renameWorkout: (id: string, name: string) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  addToWorkout: (workoutId: string, exerciseIds: string[]) => Promise<void>;
  updatePlanItem: (
    itemId: string,
    patch: Partial<Pick<PlanItem, "target_sets" | "target_reps" | "target_seconds" | "optional">>
  ) => Promise<void>;
  removePlanItem: (itemId: string) => Promise<void>;
  addCustomExercise: (input: NewExercise) => Promise<Exercise>;
  setSchedule: (mode: ScheduleMode, weekdaysByWorkout: Record<string, number[] | null>) => Promise<void>;
  saveSession: (input: {
    workoutId: string | null;
    workoutName: string;
    date: string;
    startedAt: string;
    sets: NewSessionSet[];
  }) => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData must be used inside <AppDataProvider>");
  return v;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function AppDataProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutWithItems[]>([]);
  const [sessions, setSessions] = useState<SessionWithSets[]>([]);
  const [foodLog, setFoodLog] = useState<FoodEntry[]>([]);

  const load = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - 35);
    const sinceISO = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
    const [p, ex, wk, se, fd] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("exercises").select("*"),
      supabase.from("workouts").select("*, workout_exercises(*)").eq("user_id", userId).order("sort_order"),
      supabase
        .from("sessions")
        .select("*, session_sets(*)")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("started_at", { ascending: false })
        .limit(150),
      supabase
        .from("food_log")
        .select("*")
        .gte("date", sinceISO)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
    ]);
    fail(fd.error);
    fail(p.error);
    fail(ex.error);
    fail(wk.error);
    fail(se.error);

    const prof = p.data
      ? ({ ...p.data, body_weight_kg: p.data.body_weight_kg == null ? null : Number(p.data.body_weight_kg) } as Profile)
      : null;
    const exList = (ex.data ?? []) as Exercise[];
    const byId = new Map(exList.map((e) => [e.id, e]));

    const wkList: WorkoutWithItems[] = (wk.data ?? []).map((w: any) => {
      const items: PlanItem[] = (w.workout_exercises ?? [])
        .filter((it: any) => !it.archived && byId.has(it.exercise_id))
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((it: any) => ({ ...it, exercise: byId.get(it.exercise_id) as Exercise }));
      const { workout_exercises: _drop, ...rest } = w;
      return { ...rest, items } as WorkoutWithItems;
    });

    const seList: SessionWithSets[] = (se.data ?? []).map((s: any) => {
      const { session_sets, ...rest } = s;
      const sets: SessionSet[] = (session_sets ?? [])
        .map((x: any) => ({ ...x, weight_kg: x.weight_kg == null ? null : Number(x.weight_kg) }))
        .sort((a: SessionSet, b: SessionSet) => a.set_number - b.set_number);
      return { ...rest, sets } as SessionWithSets;
    });

    const foodList: FoodEntry[] = (fd.data ?? []).map((f: any) => ({
      ...f,
      grams: f.grams == null ? null : Number(f.grams),
      fdc_id: f.fdc_id == null ? null : Number(f.fdc_id),
      calories: Number(f.calories),
      protein_g: Number(f.protein_g),
      carbs_g: Number(f.carbs_g),
      fat_g: Number(f.fat_g)
    }));

    setFoodLog(foodList);
    setProfile(prof);
    setExercises(exList);
    setWorkouts(wkList);
    setSessions(seList);
  }, [userId]);

  const refresh = useCallback(async () => {
    try {
      await load();
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load your data");
    }
  }, [load]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const lastSets = useMemo(() => {
    const m = new Map<string, SessionSet[]>();
    // sessions are newest first, so the first time we see an exercise is its latest session
    sessions.forEach((s) => {
      const byEx = new Map<string, SessionSet[]>();
      s.sets.forEach((x) => byEx.set(x.exercise_id, [...(byEx.get(x.exercise_id) ?? []), x]));
      byEx.forEach((arr, exId) => {
        if (!m.has(exId)) m.set(exId, arr);
      });
    });
    return m;
  }, [sessions]);

  // ── actions ────────────────────────────────────────────────────────────────

  const saveProfile: AppData["saveProfile"] = async (patch) => {
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
      .select("*")
      .single();
    fail(error);
    setProfile({ ...(data as Profile), body_weight_kg: data.body_weight_kg == null ? null : Number(data.body_weight_kg) });
  };

  const createPlanFromDraft: AppData["createPlanFromDraft"] = async (draft) => {
    fail((await supabase.from("workouts").delete().eq("user_id", userId)).error);
    const rows = draft.workouts.map((w, i) => ({ user_id: userId, name: w.name, sort_order: i, weekdays: w.weekdays }));
    if (rows.length === 0) return;
    const ins = await supabase.from("workouts").insert(rows).select("id, sort_order");
    fail(ins.error);
    const idFor = new Map((ins.data ?? []).map((r: any) => [r.sort_order as number, r.id as string]));
    const items = draft.workouts.flatMap((w, i) =>
      w.items.map((it, j) => ({
        workout_id: idFor.get(i) as string,
        exercise_id: it.exercise.id,
        sort_order: j,
        target_sets: it.sets,
        target_reps: it.reps,
        target_seconds: it.seconds
      }))
    );
    if (items.length > 0) fail((await supabase.from("workout_exercises").insert(items)).error);
    await refresh();
  };

  const addWorkout: AppData["addWorkout"] = async (name) => {
    fail((await supabase.from("workouts").insert({ user_id: userId, name, sort_order: workouts.length })).error);
    await refresh();
  };

  const renameWorkout: AppData["renameWorkout"] = async (id, name) => {
    fail((await supabase.from("workouts").update({ name }).eq("id", id)).error);
    await refresh();
  };

  const deleteWorkout: AppData["deleteWorkout"] = async (id) => {
    fail((await supabase.from("workouts").delete().eq("id", id)).error);
    await refresh();
  };

  const addToWorkout: AppData["addToWorkout"] = async (workoutId, exerciseIds) => {
    const w = workouts.find((x) => x.id === workoutId);
    const start = w ? Math.max(-1, ...w.items.map((i) => i.sort_order)) + 1 : 0;
    const rows = exerciseIds
      .map((id) => exerciseById.get(id))
      .filter((e): e is Exercise => !!e)
      .map((e, i) => {
        const t = targetsFor(e, profile?.goal ?? null, profile?.experience ?? null);
        return {
          workout_id: workoutId,
          exercise_id: e.id,
          sort_order: start + i,
          target_sets: t.sets,
          target_reps: t.reps,
          target_seconds: t.seconds
        };
      });
    if (rows.length === 0) return;
    fail((await supabase.from("workout_exercises").insert(rows)).error);
    await refresh();
  };

  const updatePlanItem: AppData["updatePlanItem"] = async (itemId, patch) => {
    fail((await supabase.from("workout_exercises").update(patch).eq("id", itemId)).error);
    await refresh();
  };

  const removePlanItem: AppData["removePlanItem"] = async (itemId) => {
    // archived, not deleted: your history for that exercise stays intact
    fail((await supabase.from("workout_exercises").update({ archived: true }).eq("id", itemId)).error);
    await refresh();
  };

  const addCustomExercise: AppData["addCustomExercise"] = async (input) => {
    const { data, error } = await supabase
      .from("exercises")
      .insert({ user_id: userId, priority: 60, ...input })
      .select("*")
      .single();
    fail(error);
    await refresh();
    return data as Exercise;
  };

  const setSchedule: AppData["setSchedule"] = async (mode, weekdaysByWorkout) => {
    await saveProfile({ schedule_mode: mode });
    for (const [id, days] of Object.entries(weekdaysByWorkout)) {
      fail((await supabase.from("workouts").update({ weekdays: days }).eq("id", id)).error);
    }
    await refresh();
  };

  const saveSession: AppData["saveSession"] = async ({ workoutId, workoutName, date, startedAt, sets }) => {
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: userId,
        workout_id: workoutId,
        workout_name: workoutName,
        date,
        started_at: startedAt,
        finished_at: new Date().toISOString()
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not save your workout");
    if (sets.length > 0) {
      const res = await supabase.from("session_sets").insert(sets.map((s) => ({ ...s, session_id: data.id, user_id: userId })));
      if (res.error) {
        await supabase.from("sessions").delete().eq("id", data.id); // don't leave an empty session behind
        throw new Error(res.error.message);
      }
    }
    await refresh();
  };

  const addFood: AppData["addFood"] = async (entry) => {
    fail((await supabase.from("food_log").insert({ ...entry, user_id: userId })).error);
    await refresh();
  };

  const deleteFood: AppData["deleteFood"] = async (id) => {
    fail((await supabase.from("food_log").delete().eq("id", id)).error);
    await refresh();
  };

  const applyProposal: AppData["applyProposal"] = async (proposal) => {
    const applied: string[] = [];
    const skipped: string[] = [];
    const byName = new Map(exercises.filter((e) => !e.archived).map((e) => [e.name.toLowerCase(), e]));
    // a working copy of the plan, so several changes in one proposal build on each other
    const plan = new Map(
      workouts.map((w) => [w.name.toLowerCase(), { id: w.id, name: w.name, items: new Map(w.items.map((i) => [i.exercise_id, i])), next: Math.max(-1, ...w.items.map((i) => i.sort_order)) + 1 }])
    );
    const targetFor = (e: Exercise, c: { sets?: number; reps?: number; seconds?: number }) => {
      const d = targetsFor(e, profile?.goal ?? null, profile?.experience ?? null);
      const timed = e.kind === "time";
      return { target_sets: c.sets ?? d.sets, target_reps: timed ? null : c.reps ?? d.reps, target_seconds: timed ? c.seconds ?? d.seconds : null };
    };
    const hasReplace = proposal.changes.some((c) => c.op === "replace_plan");

    for (const c of proposal.changes as Change[]) {
      if (c.op === "replace_plan") {
        const draftWorkouts: PlannedWorkout[] = c.workouts.map((w) => ({
          name: w.name,
          focus: "",
          weekdays: null,
          items: w.exercises
            .map((x) => {
              const e = byName.get(x.exercise.toLowerCase());
              if (!e) return null;
              const t = targetFor(e, x);
              return { exercise: e, sets: t.target_sets, reps: t.target_reps, seconds: t.target_seconds };
            })
            .filter((x): x is NonNullable<typeof x> => !!x)
        }));
        const usable = draftWorkouts.filter((w) => w.items.length > 0);
        if (usable.length === 0) {
          skipped.push("The new plan (none of its exercises could be matched)");
          continue;
        }
        await createPlanFromDraft({ templateId: "custom", title: "Coach plan", why: "", workouts: usable });
        applied.push(`New plan with ${usable.length} ${usable.length === 1 ? "workout" : "workouts"}`);
        continue;
      }
      if (c.op === "set_nutrition") {
        await saveProfile({
          ...(c.calories ? { calorie_target: c.calories } : {}),
          ...(c.protein_g ? { protein_target_g: c.protein_g } : {})
        });
        applied.push("Daily nutrition goal updated");
        continue;
      }
      if (hasReplace) continue; // a whole new plan already covers the smaller edits
      const w = plan.get(c.workout.toLowerCase());
      const e = byName.get(c.exercise.toLowerCase());
      if (!w || !e) {
        skipped.push(`${c.exercise} (couldn't find it in ${c.workout})`);
        continue;
      }
      const item = w.items.get(e.id);
      if (c.op === "set_target") {
        if (!item) { skipped.push(`${e.name} isn't in ${w.name}`); continue; }
        const t = targetFor(e, c);
        fail((await supabase.from("workout_exercises").update(t).eq("id", item.id)).error);
        applied.push(`${e.name}: new target in ${w.name}`);
      } else if (c.op === "remove_exercise") {
        if (!item) { skipped.push(`${e.name} isn't in ${w.name}`); continue; }
        fail((await supabase.from("workout_exercises").update({ archived: true }).eq("id", item.id)).error);
        w.items.delete(e.id);
        applied.push(`Removed ${e.name} from ${w.name}`);
      } else if (c.op === "add_exercise") {
        if (item) { skipped.push(`${e.name} is already in ${w.name}`); continue; }
        const t = targetFor(e, c);
        const ins = await supabase.from("workout_exercises").insert({ workout_id: w.id, exercise_id: e.id, sort_order: w.next++, ...t }).select("*").single();
        fail(ins.error);
        w.items.set(e.id, ins.data as PlanItem);
        applied.push(`Added ${e.name} to ${w.name}`);
      }
    }
    await refresh();
    return { applied, skipped };
  };

  const value: AppData = {
    userId,
    loading,
    loadError,
    profile,
    exercises,
    exerciseById,
    workouts,
    sessions,
    lastSets,
    foodLog,
    addFood,
    deleteFood,
    applyProposal,
    refresh,
    saveProfile,
    createPlanFromDraft,
    addWorkout,
    renameWorkout,
    deleteWorkout,
    addToWorkout,
    updatePlanItem,
    removePlanItem,
    addCustomExercise,
    setSchedule,
    saveSession
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
