import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/state/AppData";
import { computeAlerts } from "@/lib/coachRules";
import { CARB_RANGE, FAT_RANGE, shares, suggestNutrition, totalsOf } from "@/lib/nutrition";
import { dayLabel } from "@/lib/format";
import { unitToKg, weightNumber } from "@/lib/units";
import { MEALS, todayISO, type FoodEntry, type Meal } from "@/lib/types";
import { parseDay } from "@/lib/format";
import { Button, Card, ErrorNote, Field, Muted, Page, Sheet, SwipeToDelete, Tag, Title } from "./ui";
import AddFood from "./AddFood";

function shiftDay(iso: string, by: number): string {
  const d = parseDay(iso);
  d.setDate(d.getDate() + by);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Bar({ value, max, over }: { value: number; max: number; over?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
      <div className={`h-full rounded-full ${over ? "bg-warn" : "bg-accent"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A track showing where your share of calories sits against the usual range. */
function RangeBar({ pct, range, label }: { pct: number; range: [number, number]; label: string }) {
  const inside = pct >= range[0] && pct <= range[1];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[14px]">
        <span className="font-bold">{label}</span>
        <span className="flex items-center gap-2">
          <span>{pct}% of calories</span>
          <Tag tone={inside ? "success" : "warn"}>{inside ? "In usual range" : pct < range[0] ? "Low" : "High"}</Tag>
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-surface-3" role="img" aria-label={`${label} ${pct} percent of calories, usual range ${range[0]} to ${range[1]} percent`}>
        <div className="absolute inset-y-0 rounded-full bg-plum-bg ring-1 ring-plum/30" style={{ left: `${range[0]}%`, width: `${range[1] - range[0]}%` }} />
        <div className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg ${inside ? "bg-plum" : "bg-warn"}`} style={{ left: `${Math.max(2, Math.min(98, pct))}%` }} />
      </div>
      <div className="text-[12px] text-ink-2">
        Usual range {range[0]}–{range[1]}%
      </div>
    </div>
  );
}

export default function Eat({ onAskCoach }: { onAskCoach: (text: string) => void }) {
  const { foodLog, profile, deleteFood, addFood, sessions, exerciseById } = useAppData();
  const [date, setDate] = useState(todayISO());
  const [adding, setAdding] = useState<Meal | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [undo, setUndo] = useState<FoodEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const entries = useMemo(() => foodLog.filter((f) => f.date === date), [foodLog, date]);
  const totals = useMemo(() => totalsOf(entries), [entries]);
  const sh = shares(totals);
  const calTarget = profile?.calorie_target ?? null;
  const proTarget = profile?.protein_target_g ?? null;
  const nutritionAlerts = useMemo(
    () => computeAlerts({ sessions, exerciseById, profile, foodLog }).filter((a) => ["protein", "calories", "carbs", "fat"].includes(a.kind)).slice(0, 2),
    [sessions, exerciseById, profile, foodLog]
  );

  const today = todayISO();
  const title = date === today ? "Today" : date === shiftDay(today, -1) ? "Yesterday" : dayLabel(date, true);

  async function remove(e: FoodEntry) {
    setError(null);
    try {
      await deleteFood(e.id);
      setUndo(e);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    }
  }
  async function restore() {
    if (!undo) return;
    const { id: _id, user_id: _u, ...rest } = undo;
    setUndo(null);
    try {
      await addFood(rest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore.");
    }
  }

  return (
    <Page className="gap-3.5">
      <div className="flex items-center justify-between">
        <Title size={32}>Eat</Title>
        <button onClick={() => setShowGoals(true)} className="min-h-[44px] px-1 text-[14px] font-bold text-plum">
          {calTarget || proTarget ? "Edit goals" : "Set goals"}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button aria-label="Previous day" onClick={() => setDate(shiftDay(date, -1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-plum">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="text-[16px] font-bold">{title}</div>
        <button aria-label="Next day" disabled={date >= today} onClick={() => setDate(shiftDay(date, 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-plum disabled:opacity-30">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      <Card className="flex flex-col gap-3.5">
        {calTarget ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-bold">Calories</span>
              <span className="text-[14px]"><b className="font-display text-[22px] text-plum">{Math.round(totals.calories).toLocaleString()}</b> / {calTarget.toLocaleString()} kcal</span>
            </div>
            <Bar value={totals.calories} max={calTarget} over={totals.calories > calTarget * 1.1} />
          </div>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-bold">Calories</span>
            <span className="text-[14px]"><b className="font-display text-[22px] text-plum">{Math.round(totals.calories).toLocaleString()}</b> kcal</span>
          </div>
        )}
        {proTarget ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-bold">Protein</span>
              <span className="text-[14px]"><b className="font-display text-[22px] text-plum">{Math.round(totals.protein)}</b> / {proTarget} g</span>
            </div>
            <Bar value={totals.protein} max={proTarget} />
          </div>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-bold">Protein</span>
            <span className="text-[14px]"><b className="font-display text-[22px] text-plum">{Math.round(totals.protein)}</b> g</span>
          </div>
        )}
        {!calTarget && !proTarget && (
          <button onClick={() => setShowGoals(true)} className="min-h-[44px] self-start text-[14px] font-bold text-plum">
            Set daily goals
          </button>
        )}
        {totals.calories > 0 ? (
          <>
            <RangeBar pct={sh.carbsPct} range={CARB_RANGE} label={`Carbs ${Math.round(totals.carbs)} g`} />
            <RangeBar pct={sh.fatPct} range={FAT_RANGE} label={`Fat ${Math.round(totals.fat)} g`} />
          </>
        ) : (
          <Muted className="text-[13px]">Log your first meal and Coach will keep an eye on carbs and fat for you.</Muted>
        )}
      </Card>

      {nutritionAlerts.map((a) => (
        <Card key={a.id} className="flex flex-col gap-1 !p-3.5">
          <div className="flex items-center gap-2">
            <Tag tone="warn">Coach</Tag>
            <span className="text-[14px] font-bold">{a.title}</span>
          </div>
          <div className="text-[13px] text-ink-2">{a.detail}</div>
          <button onClick={() => onAskCoach(a.ask)} className="min-h-[44px] self-start text-[14px] font-bold text-plum">
            Ask Coach
          </button>
        </Card>
      ))}

      {error && <ErrorNote>{error}</ErrorNote>}

      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.id);
        const kcal = Math.round(list.reduce((s, e) => s + e.calories, 0));
        return (
          <div key={m.id} className="flex flex-col rounded-card border border-line bg-surface">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="font-display text-[18px] text-plum">{m.label}</span>
              <span className="text-[13px] text-ink-2">{kcal} kcal</span>
            </div>
            {list.map((e) => (
              <SwipeToDelete key={e.id} onDelete={() => remove(e)}>
                <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-bold">{e.name}</span>
                    <span className="text-[12px] text-ink-2">
                      {[e.grams ? `${Math.round(e.grams)} g` : null, e.state !== "unknown" ? e.state : null, `P ${Math.round(e.protein_g)} · C ${Math.round(e.carbs_g)} · F ${Math.round(e.fat_g)}`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <span className="text-[14px] font-bold">{Math.round(e.calories)}</span>
                  <button aria-label={`Delete ${e.name}`} onClick={() => remove(e)} className="flex h-11 w-9 items-center justify-center text-ink-3">
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>
                  </button>
                </div>
              </SwipeToDelete>
            ))}
            <button onClick={() => setAdding(m.id)} className="min-h-[48px] border-t border-line text-[14px] font-bold text-plum">
              + Add food
            </button>
          </div>
        );
      })}

      {undo && (
        <div role="status" className="sticky bottom-2 z-10 flex items-center justify-between rounded-full bg-plum px-5 py-2 text-[14px] text-bg shadow-lg">
          <span>Food deleted</span>
          <button onClick={restore} className="min-h-[44px] px-2 font-bold underline">
            Undo
          </button>
        </div>
      )}

      {adding && <AddFood meal={adding} date={date} onClose={() => setAdding(null)} />}
      {showGoals && <GoalsSheet onClose={() => setShowGoals(false)} />}
    </Page>
  );
}

// ── daily calorie and protein goals ──────────────────────────────────────────
function GoalsSheet({ onClose }: { onClose: () => void }) {
  const { profile, saveProfile } = useAppData();
  const unit = profile?.weight_unit ?? "kg";
  const [calories, setCalories] = useState(profile?.calorie_target ? String(profile.calorie_target) : "");
  const [protein, setProtein] = useState(profile?.protein_target_g ? String(profile.protein_target_g) : "");
  const [bodyWeight, setBodyWeight] = useState(profile?.body_weight_kg ? weightNumber(profile.body_weight_kg, unit) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const num = (s: string) => {
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const bw = num(bodyWeight);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const c = num(calories);
      const p = num(protein);
      await saveProfile({ calorie_target: c ? Math.round(c) : null, protein_target_g: p ? Math.round(p) : null, body_weight_kg: bw ? unitToKg(bw, unit) : profile?.body_weight_kg ?? null });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <Sheet title="Daily goals" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Muted>Set calories and protein. Coach keeps an eye on carbs and fat for you.</Muted>
        <Field label="Daily calories" suffix="kcal" inputMode="numeric" placeholder="e.g. 2300" value={calories} onChange={(e) => setCalories(e.target.value)} />
        <Field label="Daily protein" suffix="g" inputMode="numeric" placeholder="e.g. 140" value={protein} onChange={(e) => setProtein(e.target.value)} />
        <div className="flex flex-col gap-2.5 rounded-md2 bg-plum-bg p-3.5">
          <div className="text-[14px] leading-snug">Not sure? Coach can suggest numbers from your goal and body weight.</div>
          <div className="flex items-end gap-2.5">
            <div className="flex-1">
              <Field label="Body weight" suffix={unit} inputMode="decimal" value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} />
            </div>
            <Button
              variant="secondary"
              full={false}
              disabled={!bw}
              onClick={() => {
                const s = suggestNutrition(unitToKg(bw as number, unit), profile?.goal ?? null);
                setCalories(String(s.calories));
                setProtein(String(s.protein));
              }}
            >
              Suggest
            </Button>
          </div>
          <div className="text-[12px] text-ink-2">Rough estimates only, not medical advice. Adjust after a couple of weeks.</div>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save goals"}
        </Button>
      </div>
    </Sheet>
  );
}
