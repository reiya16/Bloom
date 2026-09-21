import { useEffect, useMemo, useState } from "react";
import { useAppData, type NewSessionSet } from "@/state/AppData";
import { planForToday } from "@/lib/schedule";
import { targetsFor, targetText } from "@/lib/suggest";
import { fmtWeight, unitToKg, weightNumber } from "@/lib/units";
import { todayISO, type Exercise, type SessionSet, type WeightUnit, type WorkoutWithItems } from "@/lib/types";
import { Button, Card, ErrorNote, Muted, Page, RadioCard, Sheet, Tag, Title } from "./ui";
import ExercisePicker from "./ExercisePicker";
import CustomExerciseSheet from "./CustomExerciseSheet";

// ── the workout in progress is kept on this phone until you finish ──────────
interface DraftSet {
  weight: string;
  reps: string;
  seconds: string;
  done: boolean;
}
interface DraftExercise {
  key: string;
  exerciseId: string;
  extra: boolean; // added for this session only
  skipped: boolean;
  targetReps: number | null;
  targetSeconds: number | null;
  sets: DraftSet[];
}
interface Draft {
  workoutId: string | null;
  workoutName: string;
  date: string;
  startedAt: string;
  exercises: DraftExercise[];
}

const draftKey = (uid: string) => `bloom_draft_${uid}`;

function loadDraft(uid: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(uid));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function storeDraft(uid: string, d: Draft | null) {
  try {
    if (d) localStorage.setItem(draftKey(uid), JSON.stringify(d));
    else localStorage.removeItem(draftKey(uid));
  } catch {
    // storage full or blocked: the workout still works, it just won't survive a reload
  }
}

const blankSet = (): DraftSet => ({ weight: "", reps: "", seconds: "", done: false });
let keyCounter = 0;
const newKey = () => `k${Date.now().toString(36)}${keyCounter++}`;

function draftFromWorkout(w: WorkoutWithItems): Draft {
  return {
    workoutId: w.id,
    workoutName: w.name,
    date: todayISO(),
    startedAt: new Date().toISOString(),
    exercises: w.items.map((it) => ({
      key: newKey(),
      exerciseId: it.exercise_id,
      extra: false,
      skipped: false,
      targetReps: it.target_reps,
      targetSeconds: it.target_seconds,
      sets: Array.from({ length: it.target_sets }, blankSet)
    }))
  };
}

const num = (s: string): number | null => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** "Last time: 60 kg: 8, 8, 7" */
function lastTimeText(ex: Exercise, last: SessionSet[] | undefined, unit: WeightUnit): string | null {
  if (!last || last.length === 0) return null;
  if (ex.kind === "time") return `Last time: ${last.map((s) => s.seconds ?? 0).join(", ")} sec`;
  if (ex.kind === "bodyweight_reps") return `Last time: ${last.map((s) => s.reps ?? 0).join(", ")} reps`;
  const weights = new Set(last.map((s) => s.weight_kg));
  if (weights.size === 1) return `Last time: ${fmtWeight(last[0].weight_kg, unit)}: ${last.map((s) => s.reps ?? 0).join(", ")}`;
  return `Last time: ${last.map((s) => `${fmtWeight(s.weight_kg, unit)} × ${s.reps ?? 0}`).join(", ")}`;
}

interface Props {
  startWorkoutId: string | null;
  onStartConsumed: () => void;
  onFinished: () => void;
  onEditPlan: () => void;
}

export default function Train({ startWorkoutId, onStartConsumed, onFinished, onEditPlan }: Props) {
  const { userId, workouts, sessions, profile, exerciseById, lastSets, saveSession, addToWorkout } = useAppData();
  const unit = profile?.weight_unit ?? "kg";

  const [draft, setDraft] = useState<Draft | null>(() => loadDraft(userId));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ name: string; sets: number } | null>(null);

  useEffect(() => storeDraft(userId, draft), [userId, draft]);

  // "Start workout" on Today opens the workout here
  useEffect(() => {
    if (!startWorkoutId) return;
    if (!draft) {
      const w = workouts.find((x) => x.id === startWorkoutId);
      if (w) {
        const d = draftFromWorkout(w);
        setDraft(d);
        setOpenKey(d.exercises[0]?.key ?? null);
      }
    }
    onStartConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWorkoutId]);

  const suggested = useMemo(() => planForToday(workouts, sessions, profile).workout, [workouts, sessions, profile]);

  function start(w: WorkoutWithItems | null) {
    const d: Draft = w
      ? draftFromWorkout(w)
      : { workoutId: null, workoutName: "Workout", date: todayISO(), startedAt: new Date().toISOString(), exercises: [] };
    setDraft(d);
    setOpenKey(d.exercises[0]?.key ?? null);
    setError(null);
  }

  function update(key: string, fn: (x: DraftExercise) => DraftExercise) {
    setDraft((d) => (d ? { ...d, exercises: d.exercises.map((x) => (x.key === key ? fn(x) : x)) } : d));
  }

  /** What the boxes suggest for a set, based on last time (or the target). */
  function hint(exerciseId: string, setIndex: number, de: DraftExercise) {
    const last = lastSets.get(exerciseId);
    const prev = last ? last[setIndex] ?? last[last.length - 1] : undefined;
    return {
      weight: prev?.weight_kg != null ? weightNumber(prev.weight_kg, unit) : "",
      reps: prev?.reps != null ? String(prev.reps) : de.targetReps != null ? String(de.targetReps) : "",
      seconds: prev?.seconds != null ? String(prev.seconds) : de.targetSeconds != null ? String(de.targetSeconds) : ""
    };
  }

  async function finish() {
    if (!draft) return;
    setError(null);
    const sets: NewSessionSet[] = [];
    draft.exercises
      .filter((x) => !x.skipped)
      .forEach((x) => {
        const ex = exerciseById.get(x.exerciseId);
        if (!ex) return;
        let n = 0;
        x.sets.forEach((s, i) => {
          const typed = s.weight.trim() !== "" || s.reps.trim() !== "" || s.seconds.trim() !== "";
          if (!s.done && !typed) return;
          const h = hint(x.exerciseId, i, x);
          const w = num(s.weight !== "" ? s.weight : s.done ? h.weight : "");
          const r = num(s.reps !== "" ? s.reps : s.done ? h.reps : "");
          const sec = num(s.seconds !== "" ? s.seconds : s.done ? h.seconds : "");
          n += 1;
          sets.push({
            exercise_id: x.exerciseId,
            set_number: n,
            weight_kg: ex.kind === "weight_reps" && w != null ? unitToKg(w, unit) : null,
            reps: ex.kind === "time" ? null : r != null ? Math.round(r) : null,
            seconds: ex.kind === "time" ? (sec != null ? Math.round(sec) : null) : null,
            is_extra: x.extra
          });
        });
      });
    if (sets.length === 0) {
      setError("Log at least one set first (tick it when you've done it).");
      return;
    }
    setSaving(true);
    try {
      await saveSession({ workoutId: draft.workoutId, workoutName: draft.workoutName, date: draft.date, startedAt: draft.startedAt, sets });
      setSummary({ name: draft.workoutName, sets: sets.length });
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your workout. It's still here, try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── after finishing ────────────────────────────────────────────────────────
  if (summary) {
    return (
      <Page>
        <Title>Nice work</Title>
        <Card className="flex flex-col gap-1">
          <div className="font-display text-[22px] text-plum">{summary.name}</div>
          <Muted>
            {summary.sets} {summary.sets === 1 ? "set" : "sets"} logged. Your progress charts are updated.
          </Muted>
        </Card>
        <div className="mt-auto">
          <Button onClick={() => { setSummary(null); onFinished(); }}>Back to Today</Button>
        </div>
      </Page>
    );
  }

  // ── choose a workout ───────────────────────────────────────────────────────
  if (!draft) {
    return (
      <Page>
        <Title size={32}>Train</Title>
        {workouts.length === 0 ? (
          <Card className="flex flex-col gap-2">
            <Muted>You don&apos;t have any workouts yet. Add one in My plan.</Muted>
            <Button onClick={onEditPlan}>Open My plan</Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-[14px] font-bold">Which workout?</div>
            {workouts.map((w) => (
              <button
                key={w.id}
                onClick={() => start(w)}
                className="flex min-h-[56px] items-center justify-between rounded-md2 border border-line bg-surface px-4 text-left"
              >
                <span className="flex flex-col">
                  <span className="text-[16px] font-bold">{w.name}</span>
                  <span className="text-[13px] text-ink-2">
                    {w.items.length} {w.items.length === 1 ? "exercise" : "exercises"}
                  </span>
                </span>
                {suggested?.id === w.id && <Tag tone="accent">Up next</Tag>}
              </button>
            ))}
          </div>
        )}
        <Button variant="secondary" onClick={() => start(null)}>
          Start an empty workout
        </Button>
      </Page>
    );
  }

  // ── workout in progress ────────────────────────────────────────────────────
  const inDraft = new Set(draft.exercises.map((x) => x.exerciseId));
  return (
    <Page className="pt-4">
      <div className="flex flex-col gap-0.5">
        <Title>{draft.workoutName}</Title>
        {draft.workoutId && (
          <button onClick={onEditPlan} className="flex min-h-[44px] items-center gap-1 self-start text-[13px] text-ink-2">
            From My plan · <b className="text-plum">Edit</b>
          </button>
        )}
      </div>

      {draft.exercises.length === 0 && <Muted>Nothing here yet. Add an exercise to get going.</Muted>}

      {draft.exercises.map((x) => {
        const ex = exerciseById.get(x.exerciseId);
        if (!ex) return null;
        const open = openKey === x.key;
        const doneCount = x.sets.filter((s) => s.done).length;
        const lastLine = lastTimeText(ex, lastSets.get(x.exerciseId), unit);
        const kindCols = ex.kind === "weight_reps" ? "grid-cols-[32px_1fr_1fr_44px]" : "grid-cols-[32px_1fr_44px]";
        return (
          <div key={x.key} className={`rounded-card border bg-surface ${x.skipped ? "border-line opacity-60" : "border-line"}`}>
            <button onClick={() => setOpenKey(open ? null : x.key)} className="flex min-h-[56px] w-full items-center justify-between px-4 text-left" aria-expanded={open}>
              <span className="flex flex-col">
                <span className="flex items-center gap-2 text-[17px] font-bold">
                  {ex.name}
                  {x.extra && <Tag tone="warn">Today only</Tag>}
                  {x.skipped && <Tag>Skipped</Tag>}
                </span>
                <span className="text-[13px] text-ink-2">
                  Target {targetText(x.sets.length, x.targetReps, x.targetSeconds)} · {doneCount} of {x.sets.length} done
                </span>
              </span>
              <svg viewBox="0 0 24 24" className={`h-5 w-5 fill-none stroke-ink-2 transition-transform ${open ? "rotate-90" : ""}`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>

            {open && !x.skipped && (
              <div className="flex flex-col gap-2.5 px-4 pb-4">
                {lastLine && <div className="text-[13px] text-ink-2">{lastLine}</div>}
                <div className={`grid ${kindCols} gap-x-2.5 text-[12px] font-bold uppercase tracking-wide text-ink-2`}>
                  <span>Set</span>
                  {ex.kind === "weight_reps" && <span>Weight ({unit})</span>}
                  {ex.kind === "time" ? <span>Seconds</span> : <span>Reps</span>}
                  <span />
                </div>
                {x.sets.map((s, i) => {
                  const h = hint(x.exerciseId, i, x);
                  const input = "min-h-[44px] w-full rounded-md2 border border-line-2 bg-bg px-3 text-ink outline-none focus:border-plum placeholder:text-ink-3";
                  return (
                    <div key={i} className={`grid ${kindCols} items-center gap-x-2.5`}>
                      <span className="text-[16px] font-bold text-plum">{i + 1}</span>
                      {ex.kind === "weight_reps" && (
                        <input
                          inputMode="decimal"
                          aria-label={`Set ${i + 1} weight in ${unit}`}
                          placeholder={h.weight}
                          value={s.weight}
                          onChange={(e) => update(x.key, (d) => ({ ...d, sets: d.sets.map((y, j) => (j === i ? { ...y, weight: e.target.value } : y)) }))}
                          className={input}
                        />
                      )}
                      {ex.kind === "time" ? (
                        <input
                          inputMode="numeric"
                          aria-label={`Set ${i + 1} seconds`}
                          placeholder={h.seconds}
                          value={s.seconds}
                          onChange={(e) => update(x.key, (d) => ({ ...d, sets: d.sets.map((y, j) => (j === i ? { ...y, seconds: e.target.value } : y)) }))}
                          className={input}
                        />
                      ) : (
                        <input
                          inputMode="numeric"
                          aria-label={`Set ${i + 1} reps`}
                          placeholder={h.reps}
                          value={s.reps}
                          onChange={(e) => update(x.key, (d) => ({ ...d, sets: d.sets.map((y, j) => (j === i ? { ...y, reps: e.target.value } : y)) }))}
                          className={input}
                        />
                      )}
                      <input
                        type="checkbox"
                        aria-label={`Set ${i + 1} done`}
                        checked={s.done}
                        onChange={(e) =>
                          update(x.key, (d) => ({
                            ...d,
                            sets: d.sets.map((y, j) =>
                              j !== i
                                ? y
                                : e.target.checked
                                ? {
                                    // ticking a set with empty boxes accepts the suggested numbers
                                    done: true,
                                    weight: y.weight || (ex.kind === "weight_reps" ? h.weight : ""),
                                    reps: y.reps || (ex.kind === "time" ? "" : h.reps),
                                    seconds: y.seconds || (ex.kind === "time" ? h.seconds : "")
                                  }
                                : { ...y, done: false }
                            )
                          }))
                        }
                        className="mx-auto h-7 w-7 accent-success"
                      />
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="secondary" className="!min-h-[44px]" onClick={() => update(x.key, (d) => ({ ...d, sets: [...d.sets, blankSet()] }))}>
                    Add set
                  </Button>
                  <Button variant="ghost" full={false} onClick={() => update(x.key, (d) => ({ ...d, skipped: true }))}>
                    Skip today
                  </Button>
                </div>
              </div>
            )}
            {x.skipped && (
              <div className="px-4 pb-3">
                <Button variant="ghost" full={false} onClick={() => update(x.key, (d) => ({ ...d, skipped: false }))}>
                  Bring it back
                </Button>
              </div>
            )}
            {x.extra && (
              <div className="px-4 pb-3">
                <Button variant="ghost" full={false} onClick={() => setDraft((d) => (d ? { ...d, exercises: d.exercises.filter((y) => y.key !== x.key) } : d))}>
                  Remove
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={() => setShowAdd(true)}
        className="flex min-h-[44px] items-center justify-center rounded-full border border-dashed border-plum text-[15px] font-bold text-plum"
      >
        Add an exercise
      </button>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="mt-auto flex flex-col gap-1 pt-2">
        <Button disabled={saving} onClick={finish}>
          {saving ? "Saving..." : "Finish workout"}
        </Button>
        {confirmDiscard ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[13px] text-ink-2">Throw away this workout?</span>
            <Button variant="ghost" full={false} onClick={() => setConfirmDiscard(false)}>
              Keep
            </Button>
            <Button variant="danger" full={false} className="!min-h-[44px]" onClick={() => { setDraft(null); setConfirmDiscard(false); }}>
              Discard
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>
            Discard workout
          </Button>
        )}
      </div>

      {showAdd && (
        <AddExerciseSheet
          canSave={!!draft.workoutId}
          workoutName={draft.workoutName}
          already={inDraft}
          onClose={() => setShowAdd(false)}
          onAdd={async (ids, always) => {
            const exs = ids.map((id) => exerciseById.get(id)).filter((e): e is Exercise => !!e);
            const added: DraftExercise[] = exs.map((e) => {
              const t = targetsFor(e, profile?.goal ?? null, profile?.experience ?? null);
              return {
                key: newKey(),
                exerciseId: e.id,
                extra: !always,
                skipped: false,
                targetReps: t.reps,
                targetSeconds: t.seconds,
                sets: Array.from({ length: t.sets }, blankSet)
              };
            });
            setDraft((d) => (d ? { ...d, exercises: [...d.exercises, ...added] } : d));
            setOpenKey(added[0]?.key ?? null);
            setShowAdd(false);
          }}
          onSavePermanently={async (ids) => {
            if (draft.workoutId) await addToWorkout(draft.workoutId, ids);
          }}
        />
      )}
    </Page>
  );

}

// ── "Add an exercise": just today, or every time ─────────────────────────────
function AddExerciseSheet({
  canSave,
  workoutName,
  already,
  onClose,
  onAdd,
  onSavePermanently
}: {
  canSave: boolean;
  workoutName: string;
  already: Set<string>;
  onClose: () => void;
  onAdd: (ids: string[], always: boolean) => Promise<void>;
  onSavePermanently: (ids: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stay, setStay] = useState<"today" | "always">("today");
  const [showCustom, setShowCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const ids = Array.from(selected);
      if (stay === "always") await onSavePermanently(ids);
      await onAdd(ids, stay === "always");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Sheet title="Add an exercise" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <ExercisePicker selected={selected} onToggle={toggle} disabledIds={already} maxListHeight="34dvh" />
        <button onClick={() => setShowCustom(true)} className="min-h-[44px] self-center text-[14px] font-bold text-plum">
          Can&apos;t find it? Add your own exercise
        </button>
        <div role="radiogroup" aria-label="How long should it stay?" className="flex flex-col gap-2">
          <div className="text-[14px] font-bold">How long should it stay?</div>
          <RadioCard selected={stay === "today"} title="Just today" blurb={`Adds it to today's ${workoutName} only. Your plan stays the same.`} onSelect={() => setStay("today")} />
          {canSave && (
            <RadioCard selected={stay === "always"} title="Every time" blurb={`Adds it to ${workoutName} for good. Remove it any time in My plan.`} onSelect={() => setStay("always")} />
          )}
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button disabled={selected.size === 0 || busy} onClick={go}>
          {busy ? "Adding..." : selected.size === 0 ? "Pick an exercise" : `Add ${selected.size} ${selected.size === 1 ? "exercise" : "exercises"}`}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {showCustom && (
        <CustomExerciseSheet
          onClose={() => setShowCustom(false)}
          onCreated={(e) => {
            setSelected((p) => new Set(p).add(e.id));
            setShowCustom(false);
          }}
        />
      )}
    </Sheet>
  );
}
