import { useMemo, useState } from "react";
import { useAppData } from "@/state/AppData";
import { EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS, GOAL_OPTIONS, GOAL_TITLE, SCHEDULE_OPTIONS } from "@/lib/options";
import { buildPlan, suggestTemplate, TEMPLATE_OPTIONS, type PlanInputs, type TemplateId } from "@/lib/suggest";
import { defaultUnit, unitToKg } from "@/lib/units";
import type { Equipment, Experience, Goal, ScheduleMode, WeightUnit } from "@/lib/types";
import { BackLink, Button, Card, ErrorNote, Eyebrow, Field, Muted, Page, RadioCard, Segmented, Stepper, Tag, Title } from "../ui";

type Step = "goal" | "where" | "nutrition" | "suggest" | "other" | "chat";

const EQUIPMENT_TITLE: Record<Equipment, string> = {
  full_gym: "Full gym",
  home_dumbbells: "Dumbbells at home",
  bodyweight: "Bodyweight only",
  mix: "A mix"
};

/** Rough starting numbers from body weight and goal. General estimates only. */
function suggestNutrition(kg: number, goal: Goal | null): { calories: number; protein: number } {
  const proteinPerKg = goal === "lose_fat" ? 2.0 : goal === "stay_fit" ? 1.4 : 1.8;
  const maintenance = kg * 33;
  const factor = goal === "build_muscle" ? 1.1 : goal === "lose_fat" ? 0.8 : 1;
  return {
    calories: Math.round((maintenance * factor) / 50) * 50,
    protein: Math.round(proteinPerKg * kg)
  };
}

export default function Onboarding({ onFinish }: { onFinish: (openPlan: boolean) => void }) {
  const { profile, saveProfile, exercises, createPlanFromDraft } = useAppData();

  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoal] = useState<Goal | null>(profile?.goal ?? null);
  const [experience, setExperience] = useState<Experience | null>(profile?.experience ?? null);
  const [equipment, setEquipment] = useState<Equipment | null>(profile?.equipment ?? "full_gym");
  const [days, setDays] = useState(profile?.workouts_per_week ?? 4);
  const [unit, setUnit] = useState<WeightUnit>(profile?.weight_unit ?? defaultUnit());
  const [calories, setCalories] = useState(profile?.calorie_target ? String(profile.calorie_target) : "");
  const [protein, setProtein] = useState(profile?.protein_target_g ? String(profile.protein_target_g) : "");
  const [bodyWeight, setBodyWeight] = useState("");
  const [template, setTemplate] = useState<TemplateId>("custom");
  const [schedule, setSchedule] = useState<ScheduleMode>("rotation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputs: PlanInputs = { goal, experience, equipment, workouts_per_week: days, schedule_mode: "rotation" };
  const suggestion = useMemo(() => suggestTemplate({ goal, experience, workouts_per_week: days }), [goal, experience, days]);
  const draft = useMemo(
    () => buildPlan(suggestion.templateId, inputs, exercises, suggestion.why),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestion, exercises, goal, experience, equipment, days]
  );

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const toNumber = (s: string): number | null => {
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // ── step 1: goal ───────────────────────────────────────────────────────────
  if (step === "goal") {
    return (
      <Page>
        <div className="flex flex-col gap-2">
          <Eyebrow>Step 1 of 4 · First time only</Eyebrow>
          <Title>What are you training for?</Title>
          <Muted className="text-[15px]">Pick the closest one. Coach uses it to judge your progress. You can change it any time.</Muted>
        </div>
        <div role="radiogroup" aria-label="Main goal" className="flex flex-col gap-2">
          {GOAL_OPTIONS.map((g) => (
            <RadioCard key={g.id} selected={goal === g.id} title={g.title} blurb={g.blurb} onSelect={() => setGoal(g.id)} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-[14px] font-bold">How long have you been lifting?</div>
          <div role="radiogroup" aria-label="Lifting experience" className="grid grid-cols-2 gap-2">
            {EXPERIENCE_OPTIONS.map((o) => {
              const on = experience === o.id;
              return (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setExperience(o.id)}
                  className={`min-h-[44px] rounded-full px-3 text-[14px] ${
                    on ? "border-2 border-plum bg-plum-bg font-bold text-plum" : "border border-line bg-surface"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <Muted className="text-[13px]">Coach speaks up sooner for newer lifters who stall.</Muted>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="mt-auto pt-2">
          <Button
            disabled={!goal || !experience || busy}
            onClick={() => run(async () => { await saveProfile({ goal, experience }); setStep("where"); })}
          >
            Continue
          </Button>
        </div>
      </Page>
    );
  }

  // ── step 2: where you train ────────────────────────────────────────────────
  if (step === "where") {
    return (
      <Page>
        <BackLink label="Back" onClick={() => setStep("goal")} />
        <div className="flex flex-col gap-2">
          <Eyebrow>Step 2 of 4 · First time only</Eyebrow>
          <Title>Where do you train?</Title>
          <Muted className="text-[15px]">This decides which exercises Coach suggests. You can change it later.</Muted>
        </div>
        <div role="radiogroup" aria-label="Equipment" className="flex flex-col gap-2">
          {EQUIPMENT_OPTIONS.map((o) => (
            <RadioCard key={o.id} selected={equipment === o.id} title={o.title} blurb={o.blurb} onSelect={() => setEquipment(o.id)} />
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-bold">Workouts per week</div>
            <Stepper value={days} min={1} max={6} label="workouts" onChange={setDays} />
          </div>
          <Muted className="text-[13px]">Pick a number you can keep up. Consistency beats intensity.</Muted>
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="text-[14px] font-bold">Weight unit</div>
          <div className="w-40">
            <Segmented label="Weight unit" value={unit} onChange={setUnit} options={[{ id: "kg", label: "kg" }, { id: "lb", label: "lb" }]} />
          </div>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="mt-auto pt-2">
          <Button
            disabled={!equipment || busy}
            onClick={() => run(async () => { await saveProfile({ equipment, workouts_per_week: days, weight_unit: unit }); setStep("nutrition"); })}
          >
            Continue
          </Button>
        </div>
      </Page>
    );
  }

  // ── step 3: nutrition (optional) ───────────────────────────────────────────
  if (step === "nutrition") {
    const bw = toNumber(bodyWeight);
    const suggestNumbers = () => {
      if (!bw) return;
      const s = suggestNutrition(unitToKg(bw, unit), goal);
      setCalories(String(s.calories));
      setProtein(String(s.protein));
    };
    return (
      <Page>
        <BackLink label="Back" onClick={() => setStep("where")} />
        <div className="flex flex-col gap-2">
          <Eyebrow>Step 3 of 4 · Optional</Eyebrow>
          <Title>Want to track nutrition?</Title>
          <Muted className="text-[15px]">
            Set calories and protein, and Coach keeps an eye on carbs and fat. Skip it now and add it any time in Eat.
          </Muted>
        </div>
        <Field label="Daily calories" suffix="kcal" inputMode="numeric" placeholder="e.g. 2300" value={calories} onChange={(e) => setCalories(e.target.value)} />
        <Field label="Daily protein" suffix="g" inputMode="numeric" placeholder="e.g. 140" value={protein} onChange={(e) => setProtein(e.target.value)} />
        <div className="flex flex-col gap-2.5 rounded-md2 bg-plum-bg p-3.5">
          <div className="text-[14px] leading-snug">Not sure what to aim for? Coach can suggest numbers from your goal and body weight.</div>
          <div className="flex items-end gap-2.5">
            <div className="flex-1">
              <Field label="Body weight" suffix={unit} inputMode="decimal" placeholder="Body weight" value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} />
            </div>
            <Button variant="secondary" full={false} disabled={!bw} onClick={suggestNumbers}>
              Suggest
            </Button>
          </div>
          <div className="text-[12px] text-ink-2">Rough estimates only, not medical advice. Adjust after a couple of weeks.</div>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="mt-auto flex flex-col gap-1 pt-2">
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const kg = bw ? unitToKg(bw, unit) : null;
                await saveProfile({
                  calorie_target: toNumber(calories) ? Math.round(toNumber(calories) as number) : null,
                  protein_target_g: toNumber(protein) ? Math.round(toNumber(protein) as number) : null,
                  body_weight_kg: kg
                });
                setStep("suggest");
              })
            }
          >
            Continue
          </Button>
          <Button variant="ghost" onClick={() => setStep("suggest")}>
            Skip for now
          </Button>
        </div>
      </Page>
    );
  }

  // ── step 4: suggested plan ─────────────────────────────────────────────────
  if (step === "suggest") {
    return (
      <Page>
        <BackLink label="Back" onClick={() => setStep("nutrition")} />
        <div className="flex flex-col gap-2">
          <Eyebrow>Step 4 of 4 · First time only</Eyebrow>
          <Title>Here&apos;s a plan for you</Title>
          <div className="flex flex-wrap gap-1.5">
            {goal && <Tag>{GOAL_TITLE[goal]}</Tag>}
            <Tag>{days} {days === 1 ? "day" : "days"} a week</Tag>
            {equipment && <Tag>{EQUIPMENT_TITLE[equipment]}</Tag>}
          </div>
        </div>
        <Card className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between pb-1.5">
            <span className="font-display text-[22px] text-plum">{draft.title}</span>
            <span className="text-[13px] text-ink-2">
              {draft.workouts.length} {draft.workouts.length === 1 ? "workout" : "workouts"}
            </span>
          </div>
          {draft.workouts.map((w) => (
            <div key={w.name} className="flex justify-between gap-3 border-t border-line py-2.5 text-[15px]">
              <span className="font-bold">{w.name}</span>
              <span className="text-right text-ink-2">{w.focus}</span>
            </div>
          ))}
          <div className="border-t border-line pt-2.5 text-[13px] leading-snug text-ink-2">
            <b className="text-ink">Why this one:</b> {draft.why} You can change any exercise afterwards.
          </div>
        </Card>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button
          disabled={busy}
          onClick={() =>
            run(async () => {
              await saveProfile({ schedule_mode: "rotation" });
              await createPlanFromDraft(draft);
              onFinish(true); // remembers to open My plan first...
              await saveProfile({ onboarding_done: true }); // ...then leaves setup
            })
          }
        >
          {busy ? "Setting up..." : "Use this plan"}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setStep("other")}>
          Show me other options
        </Button>
        <button onClick={() => setStep("chat")} className="mt-auto min-h-[44px] self-center text-[14px] font-bold text-plum">
          I already have a plan. Talk to Coach
        </button>
      </Page>
    );
  }

  // ── other starting points ──────────────────────────────────────────────────
  if (step === "other") {
    return (
      <Page>
        <BackLink label="Back to my suggestion" onClick={() => setStep("suggest")} />
        <div className="flex flex-col gap-2">
          <Title>Choose a starting point</Title>
          <Muted className="text-[15px]">Pick a starting point. You can change everything later.</Muted>
        </div>
        <div role="radiogroup" aria-label="Starting point" className="flex flex-col gap-2">
          <div className="text-[14px] font-bold">Starting point</div>
          {TEMPLATE_OPTIONS.map((t) => (
            <RadioCard key={t.id} selected={template === t.id} title={t.title} onSelect={() => setTemplate(t.id)} />
          ))}
        </div>
        <div role="radiogroup" aria-label="Schedule" className="flex flex-col gap-2">
          <div className="text-[14px] font-bold">How do you schedule workouts?</div>
          {SCHEDULE_OPTIONS.map((s) => (
            <RadioCard key={s.id} selected={schedule === s.id} title={s.title} blurb={s.blurb} onSelect={() => setSchedule(s.id)} />
          ))}
        </div>
        <Muted className="text-[13px]">Next you can name your workouts and pick your exercises, or edit the template you chose.</Muted>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="mt-auto pt-2">
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const other = buildPlan(template, { ...inputs, schedule_mode: schedule }, exercises);
                await saveProfile({ schedule_mode: schedule });
                await createPlanFromDraft(other);
                onFinish(true);
                await saveProfile({ onboarding_done: true });
              })
            }
          >
            {busy ? "Setting up..." : "Create my plan"}
          </Button>
        </div>
      </Page>
    );
  }

  // ── talk to coach (coming later) ───────────────────────────────────────────
  return (
    <Page>
      <BackLink label="Back" onClick={() => setStep("suggest")} />
      <Title>Talk to Coach</Title>
      <Card className="flex flex-col gap-2">
        <div className="text-[15px] font-bold">Coming in a later update</div>
        <Muted>
          Soon you&apos;ll be able to describe your routine in your own words and Coach will draft it for you. For now, pick the closest starting
          point and edit it in My plan.
        </Muted>
      </Card>
      <Button onClick={() => setStep("other")}>Choose a starting point</Button>
    </Page>
  );
}
