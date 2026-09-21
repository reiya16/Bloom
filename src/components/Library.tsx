import { useMemo, useState } from "react";
import { useAppData } from "@/state/AppData";
import { BackLink, Button, ErrorNote, Page, Title } from "./ui";
import ExercisePicker from "./ExercisePicker";
import CustomExerciseSheet from "./CustomExerciseSheet";

/** Pick exercises by muscle group and add them to one workout. */
export default function Library({ workoutId, onBack }: { workoutId: string; onBack: () => void }) {
  const { workouts, addToWorkout } = useAppData();
  const workout = workouts.find((w) => w.id === workoutId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCustom, setShowCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inPlan = useMemo(() => new Set((workout?.items ?? []).map((i) => i.exercise_id)), [workout]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await addToWorkout(workoutId, Array.from(selected));
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Page>
      <div className="flex flex-col gap-0.5">
        <BackLink label="My plan" onClick={onBack} />
        <Title>Add to {workout?.name ?? "workout"}</Title>
      </div>
      <ExercisePicker selected={selected} onToggle={toggle} disabledIds={inPlan} />
      <button onClick={() => setShowCustom(true)} className="min-h-[44px] self-center text-[14px] font-bold text-plum">
        Can&apos;t find it? Add your own exercise
      </button>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="mt-auto pt-2">
        <Button disabled={selected.size === 0 || busy} onClick={add}>
          {busy ? "Adding..." : selected.size === 0 ? "Pick exercises to add" : `Add ${selected.size} ${selected.size === 1 ? "exercise" : "exercises"}`}
        </Button>
      </div>
      {showCustom && (
        <CustomExerciseSheet
          onClose={() => setShowCustom(false)}
          onCreated={(e) => {
            setSelected((prev) => new Set(prev).add(e.id));
            setShowCustom(false);
          }}
        />
      )}
    </Page>
  );
}
