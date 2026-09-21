import { useState } from "react";
import { useAppData } from "@/state/AppData";
import { MUSCLE_GROUPS, type Exercise, type ExerciseEquipment, type ExerciseKind, type MuscleGroup } from "@/lib/types";
import { Button, ErrorNote, Field, Segmented, Sheet } from "./ui";

/** Small form to add an exercise that isn't in the built-in list. */
export default function CustomExerciseSheet({
  initialGroup,
  onClose,
  onCreated
}: {
  initialGroup?: MuscleGroup;
  onClose: () => void;
  onCreated: (e: Exercise) => void;
}) {
  const { addCustomExercise } = useAppData();
  const [name, setName] = useState("");
  const [group, setGroup] = useState<MuscleGroup>(initialGroup ?? "core");
  const [kind, setKind] = useState<ExerciseKind>("weight_reps");
  const [equipment, setEquipment] = useState<ExerciseEquipment>("gym");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const e = await addCustomExercise({ name: name.trim(), muscle_group: group, kind, equipment });
      onCreated(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Sheet title="Add your own exercise" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Name" placeholder="e.g. Cable crunch" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mg" className="text-[14px] font-bold">
            Muscle group
          </label>
          <select
            id="mg"
            value={group}
            onChange={(e) => setGroup(e.target.value as MuscleGroup)}
            className="min-h-[48px] rounded-md2 border border-line-2 bg-surface px-3 text-ink"
          >
            {MUSCLE_GROUPS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-[14px] font-bold">How do you log it?</div>
          <Segmented
            label="How you log it"
            value={kind}
            onChange={setKind}
            options={[
              { id: "weight_reps", label: "Weight × reps" },
              { id: "bodyweight_reps", label: "Reps" },
              { id: "time", label: "Time" }
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-[14px] font-bold">What does it need?</div>
          <Segmented
            label="Equipment needed"
            value={equipment}
            onChange={setEquipment}
            options={[
              { id: "gym", label: "Gym" },
              { id: "dumbbell", label: "Dumbbells" },
              { id: "bodyweight", label: "Nothing" }
            ]}
          />
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button disabled={busy || name.trim().length < 2} onClick={save}>
          {busy ? "Saving..." : "Save exercise"}
        </Button>
      </div>
    </Sheet>
  );
}
