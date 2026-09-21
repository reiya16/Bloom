import { useState } from "react";
import { useAppData } from "@/state/AppData";
import { SCHEDULE_OPTIONS, WEEKDAY_LABELS } from "@/lib/options";
import { targetText } from "@/lib/suggest";
import type { PlanItem, ScheduleMode, WorkoutWithItems } from "@/lib/types";
import { BackLink, Button, Card, Chip, ErrorNote, Field, Muted, Page, RadioCard, Sheet, Stepper, Tag, Title } from "./ui";

interface Props {
  onBack: () => void;
  onAddExercises: (workoutId: string) => void;
}

export default function Plan({ onBack, onAddExercises }: Props) {
  const { workouts, profile, addWorkout, renameWorkout, deleteWorkout, removePlanItem } = useAppData();
  const [openId, setOpenId] = useState<string | null>(workouts[0]?.id ?? null);
  const [editing, setEditing] = useState<PlanItem | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mode = profile?.schedule_mode ?? "rotation";
  const modeTitle = SCHEDULE_OPTIONS.find((s) => s.id === mode)?.title ?? "Rotation";

  async function safely(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Page>
      <div className="flex flex-col gap-0.5">
        <BackLink label="Today" onClick={onBack} />
        <Title>My plan</Title>
        <div className="flex items-center gap-1 pt-1 text-[14px] text-ink-2">
          Schedule: <b className="text-ink">{modeTitle}</b>
          <button onClick={() => setShowSchedule(true)} className="ml-1 flex min-h-[44px] items-center px-1 font-bold text-plum">
            Change
          </button>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {workouts.length === 0 && (
        <Card>
          <Muted>No workouts yet. Add your first one below.</Muted>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {workouts.map((w) => {
          const open = openId === w.id;
          return open ? (
            <div key={w.id} className="flex flex-col rounded-card border-2 border-plum bg-surface px-4 pb-3.5 pt-3">
              <div className="flex min-h-[40px] items-center justify-between">
                {renaming === w.id ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (renameValue.trim()) safely(async () => { await renameWorkout(w.id, renameValue.trim()); setRenaming(null); });
                    }}
                  >
                    <input
                      autoFocus
                      aria-label="Workout name"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="min-h-[44px] flex-1 rounded-md2 border border-line-2 bg-bg px-3 text-ink outline-none focus:border-plum"
                    />
                    <Button type="submit" full={false} variant="secondary" className="!min-h-[44px]">
                      Save
                    </Button>
                  </form>
                ) : (
                  <>
                    <button onClick={() => setOpenId(null)} className="text-left font-display text-[20px] text-plum">
                      {w.name}
                    </button>
                    <button
                      onClick={() => {
                        setRenaming(w.id);
                        setRenameValue(w.name);
                      }}
                      className="flex min-h-[44px] items-center px-1 text-[14px] font-bold text-plum"
                    >
                      Rename
                    </button>
                  </>
                )}
              </div>

              {mode === "fixed" && w.weekdays && w.weekdays.length > 0 && (
                <div className="pb-1 text-[13px] text-ink-2">{w.weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")}</div>
              )}

              {w.items.length === 0 && <div className="border-t border-line py-3 text-[14px] text-ink-2">No exercises yet.</div>}
              {w.items.map((it) => (
                <div key={it.id} className="flex min-h-[48px] items-center gap-2 border-t border-line text-[15px]">
                  <div className="flex flex-1 items-center gap-2">
                    <span>{it.exercise.name}</span>
                    {it.optional && <Tag>Optional</Tag>}
                  </div>
                  <button
                    onClick={() => setEditing(it)}
                    aria-label={`Edit target for ${it.exercise.name}`}
                    className="flex min-h-[44px] items-center px-1 text-[13px] text-ink-2 underline decoration-dotted"
                  >
                    {targetText(it.target_sets, it.target_reps, it.target_seconds)}
                  </button>
                  <button
                    aria-label={`Remove ${it.exercise.name}`}
                    onClick={() => safely(() => removePlanItem(it.id))}
                    className="flex h-11 w-11 items-center justify-center text-ink-2"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2.5} strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              ))}

              <div className="mt-2 flex flex-col gap-1">
                <Button onClick={() => onAddExercises(w.id)} className="!min-h-[46px] !text-[15px]">
                  Add exercises by muscle group
                </Button>
                {confirmDelete === w.id ? (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="flex-1 text-[13px] text-ink-2">Delete this workout? Your logged history stays.</span>
                    <Button variant="ghost" full={false} onClick={() => setConfirmDelete(null)}>
                      Keep
                    </Button>
                    <Button variant="danger" full={false} className="!min-h-[44px]" onClick={() => safely(async () => { await deleteWorkout(w.id); setConfirmDelete(null); })}>
                      Delete
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmDelete(w.id)}>
                    Delete workout
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <button
              key={w.id}
              onClick={() => setOpenId(w.id)}
              className="flex min-h-[48px] items-center justify-between rounded-md2 border border-line bg-surface px-4 text-left"
            >
              <span className="text-[16px] font-bold">{w.name}</span>
              <span className="text-[13px] text-ink-2">
                {w.items.length} {w.items.length === 1 ? "exercise" : "exercises"}
              </span>
            </button>
          );
        })}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = newName.trim();
          if (n) safely(async () => { await addWorkout(n); setNewName(""); });
        }}
      >
        <div className="flex-1">
          <Field label="Add a workout" placeholder="e.g. Upper body, Legs, Full body" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" full={false} disabled={!newName.trim()}>
          Add
        </Button>
      </form>

      <div className="sticky bottom-0 z-10 -mx-5 -mb-8 mt-auto border-t border-line bg-bg px-5 pb-4 pt-3">
        <Button onClick={onBack}>Done</Button>
        <div className="pt-1.5 text-center text-[12px] text-ink-2">Your changes are saved as you make them.</div>
      </div>

      {editing && <TargetSheet item={editing} onClose={() => setEditing(null)} />}
      {showSchedule && <ScheduleSheet workouts={workouts} onClose={() => setShowSchedule(false)} />}
    </Page>
  );
}

// ── edit sets, reps or time for one exercise ─────────────────────────────────
function TargetSheet({ item, onClose }: { item: PlanItem; onClose: () => void }) {
  const { updatePlanItem } = useAppData();
  const timed = item.exercise.kind === "time";
  const [sets, setSets] = useState(item.target_sets);
  const [reps, setReps] = useState(item.target_reps ?? 10);
  const [seconds, setSeconds] = useState(item.target_seconds ?? 30);
  const [optional, setOptional] = useState(item.optional);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updatePlanItem(item.id, {
        target_sets: sets,
        target_reps: timed ? null : reps,
        target_seconds: timed ? seconds : null,
        optional
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <Sheet title={item.exercise.name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold">Sets</span>
          <Stepper value={sets} min={1} max={10} label="sets" onChange={setSets} />
        </div>
        {timed ? (
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Seconds</span>
            <Stepper value={seconds} min={5} max={300} label="seconds" onChange={(v) => setSeconds(v)} />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Reps</span>
            <Stepper value={reps} min={1} max={50} label="reps" onChange={setReps} />
          </div>
        )}
        <label className="flex min-h-[44px] items-center gap-3 text-[15px]">
          <input type="checkbox" checked={optional} onChange={(e) => setOptional(e.target.checked)} className="h-5 w-5 accent-plum" />
          Optional (nice to do, fine to skip)
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save"}
        </Button>
      </div>
    </Sheet>
  );
}

// ── schedule style, and days for fixed schedules ─────────────────────────────
function ScheduleSheet({ workouts, onClose }: { workouts: WorkoutWithItems[]; onClose: () => void }) {
  const { profile, setSchedule } = useAppData();
  const [mode, setMode] = useState<ScheduleMode>(profile?.schedule_mode ?? "rotation");
  const [days, setDays] = useState<Record<string, number | null>>(
    Object.fromEntries(workouts.map((w) => [w.id, w.weekdays?.[0] ?? null]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const map: Record<string, number[] | null> = {};
      workouts.forEach((w) => {
        map[w.id] = mode === "fixed" && days[w.id] != null ? [days[w.id] as number] : null;
      });
      await setSchedule(mode, map);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <Sheet title="How do you schedule workouts?" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Schedule" className="flex flex-col gap-2">
          {SCHEDULE_OPTIONS.map((s) => (
            <RadioCard key={s.id} selected={mode === s.id} title={s.title} blurb={s.blurb} onSelect={() => setMode(s.id)} />
          ))}
        </div>
        {mode === "fixed" && (
          <div className="flex flex-col gap-3">
            <Muted>Pick a day for each workout.</Muted>
            {workouts.map((w) => (
              <div key={w.id} className="flex flex-col gap-1.5">
                <div className="text-[14px] font-bold">{w.name}</div>
                <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
                  {WEEKDAY_LABELS.map((label, d) => (
                    <Chip key={label} selected={days[w.id] === d} onClick={() => setDays((p) => ({ ...p, [w.id]: p[w.id] === d ? null : d }))}>
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save"}
        </Button>
      </div>
    </Sheet>
  );
}
