import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/state/AppData";
import { EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS, GOAL_OPTIONS } from "@/lib/options";
import type { Equipment, Experience, Goal, WeightUnit } from "@/lib/types";
import { BackLink, Button, Card, ErrorNote, Field, Muted, Page, RadioCard, Segmented, Stepper, Title } from "./ui";

export default function Settings({ onBack }: { onBack: () => void }) {
  const { session, updatePassword, signOut } = useAuth();
  const { profile, saveProfile } = useAppData();
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);

  async function save(patch: Parameters<typeof saveProfile>[0]) {
    setError(null);
    try {
      await saveProfile(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    try {
      await updatePassword(newPw);
      setNewPw("");
      setPwMsg("Password updated.");
      setShowPw(false);
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : "Could not update password.");
    }
  }

  const email = session?.user?.email ?? "";

  return (
    <Page>
      <div className="flex flex-col gap-0.5">
        <BackLink label="Today" onClick={onBack} />
        <Title>Settings</Title>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}

      <Card className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-plum-bg text-lg font-bold text-plum">{email.charAt(0).toUpperCase() || "?"}</div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold">{email}</div>
        </div>
      </Card>

      <div role="radiogroup" aria-label="Main goal" className="flex flex-col gap-2">
        <div className="text-[14px] font-bold">Main goal</div>
        {GOAL_OPTIONS.map((g) => (
          <RadioCard key={g.id} selected={profile?.goal === g.id} title={g.title} onSelect={() => save({ goal: g.id as Goal })} />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[14px] font-bold">Lifting experience</div>
        <Segmented
          label="Lifting experience"
          value={profile?.experience ?? null}
          onChange={(v: Experience) => save({ experience: v })}
          options={EXPERIENCE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
        />
      </div>

      <div role="radiogroup" aria-label="Equipment" className="flex flex-col gap-2">
        <div className="text-[14px] font-bold">Where you train</div>
        {EQUIPMENT_OPTIONS.map((o) => (
          <RadioCard key={o.id} selected={profile?.equipment === o.id} title={o.title} onSelect={() => save({ equipment: o.id as Equipment })} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold">Workouts per week</div>
        <Stepper value={profile?.workouts_per_week ?? 3} min={1} max={7} label="workouts" onChange={(v) => save({ workouts_per_week: v })} />
      </div>

      <div className="flex items-center justify-between gap-6">
        <div className="text-[14px] font-bold">Weight unit</div>
        <div className="w-40">
          <Segmented label="Weight unit" value={profile?.weight_unit ?? "kg"} onChange={(v: WeightUnit) => save({ weight_unit: v })} options={[{ id: "kg", label: "kg" }, { id: "lb", label: "lb" }]} />
        </div>
      </div>

      <Card className="flex flex-col gap-2">
        <div className="text-[12px] font-bold uppercase tracking-wide text-ink-2">Account</div>
        {!showPw ? (
          <Button variant="secondary" onClick={() => setShowPw(true)}>
            Change password
          </Button>
        ) : (
          <form onSubmit={changePassword} className="flex flex-col gap-2">
            <Field label="New password" type="password" minLength={6} required autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowPw(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        )}
        {pwMsg && <Muted>{pwMsg}</Muted>}
        {!confirmOut ? (
          <Button variant="ghost" className="!text-danger" onClick={() => setConfirmOut(true)}>
            Sign out
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[13px] text-ink-2">Sign out of Bloom?</span>
            <Button variant="ghost" full={false} onClick={() => setConfirmOut(false)}>
              Stay
            </Button>
            <Button variant="danger" full={false} className="!min-h-[44px]" onClick={signOut}>
              Sign out
            </Button>
          </div>
        )}
      </Card>
    </Page>
  );
}
