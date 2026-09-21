import { useMemo, useState } from "react";
import { useAppData } from "@/state/AppData";
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from "@/lib/types";
import { allowedEquipment } from "@/lib/suggest";
import { Chip, Tag } from "./ui";

interface Props {
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** Exercises that can't be picked again (already in this workout). */
  disabledIds?: Set<string>;
  /** Show at most this height, then scroll (used inside a sheet). */
  maxListHeight?: string;
}

/** Browse exercises by muscle group and tick the ones you want. */
export default function ExercisePicker({ selected, onToggle, disabledIds, maxListHeight }: Props) {
  const { exercises, profile } = useAppData();
  const [group, setGroup] = useState<MuscleGroup>("chest");
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(true);

  const allowed = useMemo(() => allowedEquipment(profile?.equipment ?? null), [profile?.equipment]);
  const searching = query.trim().length > 0;

  const list: Exercise[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => !e.archived)
      .filter((e) => (searching ? e.name.toLowerCase().includes(q) : e.muscle_group === group))
      .filter((e) => !onlyMine || e.user_id !== null || allowed.has(e.equipment) || selected.has(e.id))
      .sort((a, b) => {
        const mine = (a.user_id ? 0 : 1) - (b.user_id ? 0 : 1); // your own exercises first
        return mine || a.priority - b.priority || a.name.localeCompare(b.name);
      });
  }, [exercises, group, query, searching, onlyMine, allowed, selected]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        placeholder="Search exercises"
        aria-label="Search exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="min-h-[48px] rounded-full border border-line-2 bg-surface px-4 text-ink outline-none focus:border-plum"
      />
      {!searching && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
          {MUSCLE_GROUPS.map((m) => (
            <Chip key={m.id} selected={group === m.id} onClick={() => setGroup(m.id)}>
              {m.label}
            </Chip>
          ))}
        </div>
      )}
      <label className="flex min-h-[44px] items-center gap-2.5 text-[14px] text-ink-2">
        <input
          type="checkbox"
          checked={onlyMine}
          onChange={(e) => setOnlyMine(e.target.checked)}
          className="h-5 w-5 accent-plum"
        />
        Only exercises that fit my equipment
      </label>
      <div className="overflow-y-auto rounded-card border border-line bg-surface px-4" style={maxListHeight ? { maxHeight: maxListHeight } : undefined}>
        {list.length === 0 && <div className="py-4 text-[14px] text-ink-2">Nothing here. Try another muscle group, or turn off the equipment filter.</div>}
        {list.map((e, i) => {
          const inPlan = disabledIds?.has(e.id) ?? false;
          const on = selected.has(e.id);
          return (
            <label
              key={e.id}
              className={`flex min-h-[52px] items-center gap-3 text-[15px] ${i > 0 ? "border-t border-line" : ""} ${inPlan ? "text-ink-2" : on ? "font-bold" : ""}`}
            >
              <input
                type="checkbox"
                checked={on || inPlan}
                disabled={inPlan}
                onChange={() => onToggle(e.id)}
                className="h-[22px] w-[22px] flex-shrink-0 accent-accent"
              />
              <span className="flex-1">
                {e.name}
                {searching && <span className="ml-2 text-[12px] font-normal text-ink-3">{MUSCLE_GROUPS.find((m) => m.id === e.muscle_group)?.label}</span>}
              </span>
              {inPlan && <Tag>In plan</Tag>}
              {e.user_id && !inPlan && <Tag tone="accent">Yours</Tag>}
            </label>
          );
        })}
      </div>
    </div>
  );
}
