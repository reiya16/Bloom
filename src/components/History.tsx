import { useMemo, useState } from "react";
import { useAppData, type SessionWithSets } from "@/state/AppData";
import { describeSets, dayLabel, monthLabel } from "@/lib/format";
import type { Exercise, SessionSet } from "@/lib/types";
import { Card, Chip, Muted, Segmented, Tag } from "./ui";

const HISTORY_LIMIT = 150; // how many recent workouts the app loads

/** Sets grouped by exercise, in the order the exercises were done. */
function byExercise(sets: SessionSet[]): { exerciseId: string; sets: SessionSet[] }[] {
  const out: { exerciseId: string; sets: SessionSet[] }[] = [];
  sets.forEach((s) => {
    const g = out.find((x) => x.exerciseId === s.exercise_id);
    if (g) g.sets.push(s);
    else out.push({ exerciseId: s.exercise_id, sets: [s] });
  });
  return out;
}

/** The number that counts as "best" for an exercise in one session. */
function topValue(ex: Exercise, sets: SessionSet[]): number {
  return Math.max(0, ...sets.map((s) => (ex.kind === "weight_reps" ? s.weight_kg : ex.kind === "time" ? s.seconds : s.reps) ?? 0));
}

export default function History() {
  const { sessions } = useAppData();
  const [view, setView] = useState<"date" | "exercise">("date");

  return (
    <div className="flex flex-col gap-3.5">
      <Segmented
        label="History view"
        value={view}
        onChange={setView}
        options={[
          { id: "date", label: "By date" },
          { id: "exercise", label: "By exercise" }
        ]}
      />
      {view === "date" ? <ByDate sessions={sessions} /> : <ByExercise sessions={sessions} />}
      {sessions.length >= HISTORY_LIMIT && <Muted className="text-center text-[12px]">Showing your latest {HISTORY_LIMIT} workouts.</Muted>}
    </div>
  );
}

// ── every workout, newest first ──────────────────────────────────────────────
function ByDate({ sessions }: { sessions: SessionWithSets[] }) {
  const { exerciseById, profile } = useAppData();
  const unit = profile?.weight_unit ?? "kg";
  const [open, setOpen] = useState<string | null>(sessions[0]?.id ?? null);

  const groups = useMemo(() => {
    const out: { month: string; items: SessionWithSets[] }[] = [];
    sessions.forEach((s) => {
      const m = monthLabel(s.date);
      const last = out[out.length - 1];
      if (last && last.month === m) last.items.push(s);
      else out.push({ month: m, items: [s] });
    });
    return out;
  }, [sessions]);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.month} className="flex flex-col gap-2">
          <div className="text-[13px] font-bold uppercase tracking-wide text-ink-2">{g.month}</div>
          {g.items.map((s) => {
            const isOpen = open === s.id;
            const groupsOfSets = byExercise(s.sets);
            return (
              <div key={s.id} className="rounded-card border border-line bg-surface">
                <button
                  onClick={() => setOpen(isOpen ? null : s.id)}
                  aria-expanded={isOpen}
                  className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 text-left"
                >
                  <span className="flex flex-col">
                    <span className="text-[16px] font-bold">{s.workout_name}</span>
                    <span className="text-[13px] text-ink-2">
                      {dayLabel(s.date)} · {groupsOfSets.length} {groupsOfSets.length === 1 ? "exercise" : "exercises"} · {s.sets.length} {s.sets.length === 1 ? "set" : "sets"}
                    </span>
                  </span>
                  <svg viewBox="0 0 24 24" className={`h-5 w-5 flex-shrink-0 fill-none stroke-ink-2 transition-transform ${isOpen ? "rotate-90" : ""}`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="flex flex-col px-4 pb-2">
                    {groupsOfSets.map((x) => {
                      const ex = exerciseById.get(x.exerciseId);
                      if (!ex) return null;
                      return (
                        <div key={x.exerciseId} className="flex flex-col gap-0.5 border-t border-line py-2.5">
                          <div className="flex items-center gap-2 text-[15px] font-bold">
                            {ex.name}
                            {x.sets.every((t) => t.is_extra) && <Tag tone="warn">Today only</Tag>}
                          </div>
                          <div className="text-[14px] text-ink-2">{describeSets(ex, x.sets, unit)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── one exercise across every workout ────────────────────────────────────────
function ByExercise({ sessions }: { sessions: SessionWithSets[] }) {
  const { exerciseById, profile } = useAppData();
  const unit = profile?.weight_unit ?? "kg";

  const { order, entries } = useMemo(() => {
    const map = new Map<string, { session: SessionWithSets; sets: SessionSet[] }[]>();
    // sessions come newest first, so the first time we meet an exercise is its latest workout
    const order: string[] = [];
    sessions.forEach((s) =>
      byExercise(s.sets).forEach((g) => {
        if (!map.has(g.exerciseId)) {
          map.set(g.exerciseId, []);
          order.push(g.exerciseId);
        }
        map.get(g.exerciseId)!.push({ session: s, sets: g.sets });
      })
    );
    return { order, entries: map };
  }, [sessions]);

  const [picked, setPicked] = useState<string | null>(null);
  const exId = picked && entries.has(picked) ? picked : order[0] ?? null;
  const ex = exId ? exerciseById.get(exId) : null;
  const rows = exId ? entries.get(exId) ?? [] : [];

  // the workout where your best number was first reached
  const bestSessionId = useMemo(() => {
    if (!ex) return null;
    let best = 0;
    let id: string | null = null;
    [...rows].reverse().forEach((r) => {
      const v = topValue(ex, r.sets);
      if (v > best) {
        best = v;
        id = r.session.id;
      }
    });
    return id;
  }, [ex, rows]);

  if (!ex) return <Muted>No exercises logged yet.</Muted>;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
        {order.map((id) => (
          <Chip key={id} selected={id === exId} onClick={() => setPicked(id)}>
            {exerciseById.get(id)?.name}
          </Chip>
        ))}
      </div>
      <Card className="flex flex-col !p-0">
        <div className="px-4 pb-1 pt-3.5 text-[13px] text-ink-2">
          {rows.length} {rows.length === 1 ? "workout" : "workouts"} with {ex.name}
        </div>
        {rows.map((r) => (
          <div key={r.session.id} className="flex items-start justify-between gap-3 border-t border-line px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <div className="text-[15px] font-bold">{dayLabel(r.session.date, true)}</div>
              <div className="text-[13px] text-ink-2">{r.session.workout_name}</div>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <div className="text-[14px]">{describeSets(ex, r.sets, unit)}</div>
              {r.session.id === bestSessionId && <Tag tone="success">Best so far</Tag>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
