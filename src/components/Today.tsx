import { useMemo } from "react";
import { useAppData } from "@/state/AppData";
import { currentWeek, planForToday } from "@/lib/schedule";
import { targetText } from "@/lib/suggest";
import { GOAL_TITLE } from "@/lib/options";
import { todayISO } from "@/lib/types";
import { Button, Card, Muted, Page, Tag, Title } from "./ui";

interface Props {
  onStart: (workoutId: string) => void;
  onEditPlan: () => void;
  onOpenSettings: () => void;
  onChooseWorkout: () => void;
}

export default function Today({ onStart, onEditPlan, onOpenSettings, onChooseWorkout }: Props) {
  const { workouts, sessions, profile } = useAppData();
  const plan = useMemo(() => planForToday(workouts, sessions, profile), [workouts, sessions, profile]);
  const week = useMemo(() => currentWeek(workouts, sessions, profile), [workouts, sessions, profile]);
  const doneToday = sessions.some((s) => s.date === todayISO());
  const doneThisWeek = week.filter((d) => d.done).length;
  const fixed = profile?.schedule_mode === "fixed";
  const planned = fixed ? week.filter((d) => d.planned).length : profile?.workouts_per_week ?? workouts.length;

  return (
    <Page className="gap-3.5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-[13px] font-medium text-ink-2">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <Title size={32}>Today</Title>
        </div>
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-2"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
          </svg>
        </button>
      </div>

      {profile?.goal && (
        <button
          onClick={onOpenSettings}
          className="flex min-h-[44px] items-center self-start rounded-full bg-plum-bg px-4 text-[14px] font-bold text-plum"
        >
          Goal: {GOAL_TITLE[profile.goal]}
        </button>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[13px] font-medium text-ink-2">
          <span>This week</span>
          <span>
            {doneThisWeek} of {planned} {planned === 1 ? "workout" : "workouts"}
          </span>
        </div>
        <div className="flex justify-between" role="list" aria-label="This week">
          {week.map((d) => (
            <div key={d.iso} role="listitem" className="flex flex-col items-center gap-1.5 text-[12px] font-medium text-ink-2">
              {d.label}
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-[14px] ${
                  d.done
                    ? "bg-success font-bold text-white"
                    : d.isToday
                    ? "bg-accent font-bold text-accent-ink"
                    : d.planned
                    ? "border-2 border-plum font-bold text-plum"
                    : "text-ink-2"
                }`}
                aria-label={`${d.dayNumber}${d.done ? ", done" : d.isToday ? ", today" : d.planned ? ", planned" : ""}`}
              >
                {d.dayNumber}
              </div>
            </div>
          ))}
        </div>
      </div>

      {workouts.length === 0 ? (
        <Card className="flex flex-col gap-2">
          <div className="text-[16px] font-bold">No workouts yet</div>
          <Muted>Build your plan to get started.</Muted>
          <Button onClick={onEditPlan}>Open My plan</Button>
        </Card>
      ) : plan.isRestDay ? (
        <Card className="flex flex-col gap-2">
          <div className="font-display text-[22px] text-plum">Rest day</div>
          <Muted>{plan.nextText ? `Next up: ${plan.nextText}.` : "Nothing scheduled today."}</Muted>
          <Button variant="secondary" onClick={onChooseWorkout}>
            Train anyway
          </Button>
        </Card>
      ) : plan.workout ? (
        <Card className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-[22px] text-plum">{plan.workout.name}</span>
              {doneToday && <Tag tone="success">Done today</Tag>}
            </div>
            <button onClick={onEditPlan} className="flex min-h-[44px] items-center text-[14px] font-bold text-plum">
              Edit plan
            </button>
          </div>
          {plan.workout.items.length === 0 && <div className="border-t border-line py-2.5 text-[14px] text-ink-2">No exercises yet. Add some in My plan.</div>}
          {plan.workout.items.slice(0, 7).map((it) => (
            <div key={it.id} className="flex justify-between gap-3 border-t border-line py-2.5 text-[15px]">
              <span>{it.exercise.name}</span>
              <span className="text-ink-2">{targetText(it.target_sets, it.target_reps, it.target_seconds)}</span>
            </div>
          ))}
          {plan.workout.items.length > 7 && <div className="border-t border-line pt-2.5 text-[13px] text-ink-2">+ {plan.workout.items.length - 7} more</div>}
          <Button className="mt-2" onClick={() => onStart((plan.workout as { id: string }).id)}>
            {doneToday ? "Start another workout" : "Start workout"}
          </Button>
        </Card>
      ) : null}
    </Page>
  );
}
