import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/state/AppData";
import { findSibling, searchFoods } from "@/lib/functions";
import { OZ_TO_G, scale } from "@/lib/nutrition";
import { MEALS, type FoodEntry, type FoodHit, type FoodState, type Meal } from "@/lib/types";
import { Button, Chip, ErrorNote, Field, Muted, RadioCard, Segmented, Sheet } from "./ui";

interface Props {
  meal: Meal;
  date: string;
  onClose: () => void;
}

type Tab = "search" | "recent" | "manual";

export default function AddFood({ meal, date, onClose }: Props) {
  const { addFood, foodLog } = useAppData();
  const [tab, setTab] = useState<Tab>("search");
  const [picked, setPicked] = useState<FoodHit | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (picked) {
    return <FoodDetail hit={picked} meal={meal} date={date} onBack={() => setPicked(null)} onClose={onClose} />;
  }

  return (
    <Sheet title={`Add to ${MEALS.find((m) => m.id === meal)?.label ?? "meal"}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Segmented
          label="How to add"
          value={tab}
          onChange={setTab}
          options={[
            { id: "search", label: "Search" },
            { id: "recent", label: "Recent" },
            { id: "manual", label: "Manual" }
          ]}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        {tab === "search" && <SearchTab onPick={setPicked} onManual={() => setTab("manual")} />}
        {tab === "recent" && (
          <RecentTab
            entries={foodLog}
            onPick={async (e) => {
              setError(null);
              try {
                const { id: _i, user_id: _u, ...rest } = e;
                await addFood({ ...rest, date, meal });
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not add.");
              }
            }}
          />
        )}
        {tab === "manual" && <ManualTab meal={meal} date={date} onDone={onClose} />}
      </div>
    </Sheet>
  );
}

// ── search the USDA database ─────────────────────────────────────────────────
function SearchTab({ onPick, onManual }: { onPick: (h: FoodHit) => void; onManual: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<FoodHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      setError(null);
      return;
    }
    const id = ++request.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await searchFoods(q);
        if (id === request.current) setHits(res);
      } catch (e) {
        if (id === request.current) {
          setHits(null);
          setError(e instanceof Error ? e.message : "Search failed.");
        }
      } finally {
        if (id === request.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        autoFocus
        aria-label="Search foods"
        placeholder="Search foods, e.g. chicken breast"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="min-h-[48px] rounded-full border border-line-2 bg-surface px-4 text-ink outline-none focus:border-plum"
      />
      {loading && <Muted>Searching...</Muted>}
      {error && (
        <div className="flex flex-col gap-2">
          <ErrorNote>{error}</ErrorNote>
          <button onClick={onManual} className="min-h-[44px] self-start text-[14px] font-bold text-plum">
            Add it manually instead
          </button>
        </div>
      )}
      {hits && hits.length === 0 && !loading && <Muted>No matches. Try a simpler word, or add it manually.</Muted>}
      {hits && hits.length > 0 && (
        <div className="flex max-h-[42dvh] flex-col overflow-y-auto rounded-card border border-line bg-surface px-4">
          {hits.map((h, i) => (
            <button key={h.fdcId} onClick={() => onPick(h)} className={`flex min-h-[56px] items-center justify-between gap-3 py-2 text-left ${i > 0 ? "border-t border-line" : ""}`}>
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-bold">{h.name}</span>
                <span className="text-[12px] text-ink-2">{[h.brand, h.state !== "unknown" ? h.state : null].filter(Boolean).join(" · ") || "USDA"}</span>
              </span>
              <span className="flex-shrink-0 text-[12px] text-ink-2">{h.per100g.calories} kcal / 100 g</span>
            </button>
          ))}
        </div>
      )}
      {!hits && !error && !loading && <Muted className="text-[13px]">Numbers come from the USDA food database. Common foods list raw and cooked versions.</Muted>}
    </div>
  );
}

// ── log something you've had before with one tap ─────────────────────────────
function RecentTab({ entries, onPick }: { entries: FoodEntry[]; onPick: (e: FoodEntry) => void }) {
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: FoodEntry[] = [];
    for (const e of entries) {
      const key = `${e.name}|${e.brand ?? ""}|${Math.round(e.grams ?? 0)}|${Math.round(e.calories)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
      if (out.length >= 15) break;
    }
    return out;
  }, [entries]);

  if (recent.length === 0) return <Muted>Foods you log will show up here, so you can add them again with one tap.</Muted>;
  return (
    <div className="flex max-h-[50dvh] flex-col overflow-y-auto rounded-card border border-line bg-surface px-4">
      {recent.map((e, i) => (
        <button key={e.id} onClick={() => onPick(e)} className={`flex min-h-[56px] items-center justify-between gap-3 py-2 text-left ${i > 0 ? "border-t border-line" : ""}`}>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-bold">{e.name}</span>
            <span className="text-[12px] text-ink-2">{[e.grams ? `${Math.round(e.grams)} g` : null, e.state !== "unknown" ? e.state : null].filter(Boolean).join(" · ") || "Tap to add again"}</span>
          </span>
          <span className="flex-shrink-0 text-[14px] font-bold">{Math.round(e.calories)} kcal</span>
        </button>
      ))}
    </div>
  );
}

// ── type the numbers in yourself ─────────────────────────────────────────────
function ManualTab({ meal, date, onDone }: { meal: Meal; date: string; onDone: () => void }) {
  const { addFood } = useAppData();
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = (s: string) => {
    const v = parseFloat(s.replace(",", "."));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  // if only macros are typed, estimate the calories from them
  const calories = cal.trim() !== "" ? n(cal) : Math.round(n(p) * 4 + n(c) * 4 + n(f) * 9);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await addFood({ date, meal, name: name.trim(), brand: null, fdc_id: null, grams: null, state: "unknown", calories, protein_g: n(p), carbs_g: n(c), fat_g: n(f) });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Name" placeholder="e.g. Mom's dal" value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="Calories" suffix="kcal" inputMode="numeric" placeholder={calories ? String(calories) : ""} value={cal} onChange={(e) => setCal(e.target.value)} />
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Protein" suffix="g" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
        <Field label="Carbs" suffix="g" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} />
        <Field label="Fat" suffix="g" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button disabled={busy || name.trim().length < 1 || (calories <= 0 && n(p) + n(c) + n(f) <= 0)} onClick={save}>
        {busy ? "Adding..." : "Add"}
      </Button>
    </div>
  );
}

// ── how much did you have? ───────────────────────────────────────────────────
function FoodDetail({ hit, meal, date, onBack, onClose }: { hit: FoodHit; meal: Meal; date: string; onBack: () => void; onClose: () => void }) {
  const { addFood } = useAppData();
  const [food, setFood] = useState<FoodHit>(hit);
  const [choice, setChoice] = useState<FoodState>(hit.state);
  const [amount, setAmount] = useState(String(Math.round(hit.servingG ?? 100)));
  const [unit, setUnit] = useState<"g" | "oz">("g");
  const [mealChoice, setMealChoice] = useState<Meal>(meal);
  const [note, setNote] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = parseFloat(amount.replace(",", "."));
  const grams = Number.isFinite(value) && value > 0 ? (unit === "oz" ? value * OZ_TO_G : value) : 0;
  const macros = scale(food.per100g, grams);
  const matters = hit.state !== "unknown"; // raw and cooked versions exist for this food

  async function pickState(s: FoodState) {
    setChoice(s);
    setNote(null);
    if (s === "unknown" || s === food.state) return;
    setSwapping(true);
    try {
      const sib = await findSibling(food, s);
      if (sib) setFood(sib);
      else setNote(`No ${s} version found, so the numbers below are for the ${food.state} one.`);
    } catch {
      setNote("Couldn't look up that version right now.");
    } finally {
      setSwapping(false);
    }
  }

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await addFood({
        date,
        meal: mealChoice,
        name: food.name,
        brand: food.brand,
        fdc_id: food.fdcId,
        grams: Math.round(grams * 10) / 10,
        state: matters ? choice : "unknown",
        calories: macros.calories,
        protein_g: macros.protein,
        carbs_g: macros.carbs,
        fat_g: macros.fat
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add.");
      setBusy(false);
    }
  }

  return (
    <Sheet title={food.name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <button onClick={onBack} className="-mt-2 min-h-[44px] self-start text-[14px] font-bold text-plum">
          Back to search
        </button>
        {food.brand && <Muted>{food.brand}</Muted>}

        <div className="flex flex-col gap-2">
          <div className="text-[14px] font-bold">How much?</div>
          <div className="flex items-center gap-2">
            <div className="flex min-h-[48px] flex-1 items-center rounded-md2 border border-line-2 bg-surface px-3.5 focus-within:border-plum">
              <input aria-label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none" />
            </div>
            <div className="w-32">
              <Segmented label="Unit" value={unit} onChange={setUnit} options={[{ id: "g", label: "g" }, { id: "oz", label: "oz" }]} />
            </div>
          </div>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
            {food.servingG && (
              <Chip onClick={() => { setUnit("g"); setAmount(String(Math.round(food.servingG as number))); }}>
                1 serving ({Math.round(food.servingG)} g)
              </Chip>
            )}
            {[50, 100, 150, 200].map((g) => (
              <Chip key={g} onClick={() => { setUnit("g"); setAmount(String(g)); }}>
                {g} g
              </Chip>
            ))}
          </div>
        </div>

        {matters && (
          <div role="radiogroup" aria-label="Raw or cooked" className="flex flex-col gap-2">
            <div className="text-[14px] font-bold">Did you weigh it raw or cooked?</div>
            <RadioCard selected={choice === "raw"} title="Raw" blurb="Weighed before cooking." onSelect={() => pickState("raw")} />
            <RadioCard selected={choice === "cooked"} title="Cooked" blurb="Weighed after cooking." onSelect={() => pickState("cooked")} />
            <RadioCard selected={choice === "unknown"} title="Not sure" blurb="Weight changes when food cooks, so the numbers can be a little off. That's fine." onSelect={() => pickState("unknown")} />
            {swapping && <Muted className="text-[13px]">Looking up that version...</Muted>}
            {note && <Muted className="text-[13px]">{note}</Muted>}
          </div>
        )}

        <div className="flex flex-col gap-1 rounded-md2 bg-plum-bg px-4 py-3">
          <div className="font-display text-[26px] text-plum">{macros.calories} kcal</div>
          <div className="text-[14px]">
            Protein {macros.protein} g · Carbs {macros.carbs} g · Fat {macros.fat} g
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-[14px] font-bold">Meal</div>
          <div role="radiogroup" aria-label="Meal" className="-mx-5 flex gap-2 overflow-x-auto px-5">
            {MEALS.map((m) => (
              <Chip key={m.id} selected={mealChoice === m.id} onClick={() => setMealChoice(m.id)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
        <Button disabled={busy || grams <= 0 || swapping} onClick={add}>
          {busy ? "Adding..." : "Add"}
        </Button>
      </div>
    </Sheet>
  );
}
