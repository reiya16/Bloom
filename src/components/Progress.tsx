import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { useAppData } from "@/state/AppData";
import { kgToUnit } from "@/lib/units";
import { todayISO } from "@/lib/types";
import { Card, Chip, Muted, Page, Tag, Title } from "./ui";

interface Point {
  date: string;
  value: number;
}

const isDark = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

function dayDiff(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

export default function Progress() {
  const { sessions, exerciseById, profile } = useAppData();
  const unit = profile?.weight_unit ?? "kg";

  // for each exercise, the best number from each session (heaviest set, most reps, longest hold)
  const history = useMemo(() => {
    const byEx = new Map<string, Map<string, number>>();
    const last = new Map<string, string>();
    sessions.forEach((s) =>
      s.sets.forEach((set) => {
        const ex = exerciseById.get(set.exercise_id);
        if (!ex) return;
        const v = ex.kind === "weight_reps" ? set.weight_kg : ex.kind === "time" ? set.seconds : set.reps;
        if (v == null) return;
        const m = byEx.get(ex.id) ?? new Map<string, number>();
        const key = s.id;
        m.set(key, Math.max(m.get(key) ?? 0, v));
        byEx.set(ex.id, m);
        if (!last.has(ex.id) || s.date > (last.get(ex.id) as string)) last.set(ex.id, s.date);
      })
    );
    const dateOf = new Map(sessions.map((s) => [s.id, s.date]));
    const out = new Map<string, Point[]>();
    byEx.forEach((m, exId) => {
      const pts = Array.from(m.entries())
        .map(([sid, v]) => ({ date: dateOf.get(sid) as string, value: v }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      out.set(exId, pts);
    });
    const order = Array.from(last.entries()).sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([id]) => id);
    return { out, order };
  }, [sessions, exerciseById]);

  const [picked, setPicked] = useState<string | null>(null);
  const exId = picked && history.out.has(picked) ? picked : history.order[0] ?? null;
  const ex = exId ? exerciseById.get(exId) : null;
  const points = exId ? history.out.get(exId) ?? [] : [];

  const display = (v: number) => (ex?.kind === "weight_reps" ? kgToUnit(v, unit) : v);
  const unitLabel = ex?.kind === "weight_reps" ? unit : ex?.kind === "time" ? "sec" : "reps";
  const flat = points.length >= 3 && points.slice(-3).every((p) => p.value === points[points.length - 1].value);

  // week tiles
  const today = todayISO();
  const stats = useMemo(() => {
    let thisWeek = 0;
    let lastWeek = 0;
    let sessionsThisWeek = 0;
    sessions.forEach((s) => {
      const age = dayDiff(today, s.date);
      const volume = s.sets.reduce((sum, x) => sum + (x.weight_kg && x.reps ? x.weight_kg * x.reps : 0), 0);
      if (age >= 0 && age < 7) {
        thisWeek += volume;
        sessionsThisWeek += 1;
      } else if (age >= 7 && age < 14) lastWeek += volume;
    });
    return { thisWeek, lastWeek, sessionsThisWeek };
  }, [sessions, today]);

  if (sessions.length === 0) {
    return (
      <Page>
        <Title size={32}>Progress</Title>
        <Card className="flex flex-col gap-1.5">
          <div className="text-[15px] font-bold">Nothing to show yet</div>
          <Muted>Finish a workout in Train and your charts will appear here.</Muted>
        </Card>
      </Page>
    );
  }

  const dark = isDark();
  const ink = dark ? "#B6A9BC" : "#6B5A69";
  const plum = dark ? "#E2BEE0" : "#4B1F4A";
  const grid = dark ? "rgba(255,255,255,0.08)" : "rgba(75,31,74,0.08)";

  return (
    <Page>
      <Title size={32}>Progress</Title>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
        {history.order.map((id) => (
          <Chip key={id} selected={id === exId} onClick={() => setPicked(id)}>
            {exerciseById.get(id)?.name}
          </Chip>
        ))}
      </div>

      {ex && (
        <Card className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[16px] font-bold">{ex.name}</div>
              <div className="text-[13px] text-ink-2">
                Best {ex.kind === "weight_reps" ? "weight" : ex.kind === "time" ? "hold" : "reps"} each session ({unitLabel})
              </div>
            </div>
            {flat && <Tag tone="accent">Flat for 3 sessions</Tag>}
          </div>
          {points.length < 2 ? (
            <Muted>Log this exercise once more to see a line.</Muted>
          ) : (
            <div className="h-[190px]">
              <Line
                data={{
                  labels: points.map((p) => new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
                  datasets: [
                    {
                      data: points.map((p) => display(p.value)),
                      borderColor: plum,
                      backgroundColor: plum,
                      borderWidth: 3,
                      tension: 0.25,
                      pointRadius: 4,
                      pointBackgroundColor: points.map((_, i) => (flat && i >= points.length - 3 ? "#C8452F" : plum))
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: { color: ink, maxTicksLimit: 5 }, grid: { display: false } },
                    y: { ticks: { color: ink }, grid: { color: grid } }
                  }
                }}
              />
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Card className="flex flex-col gap-0.5 !p-3">
          <div className="text-[12px] text-ink-2">Last 7 days</div>
          <div className="font-display text-[24px] text-plum">
            {stats.sessionsThisWeek}
            {profile?.workouts_per_week ? <span className="text-[16px] text-ink-2"> of {profile.workouts_per_week}</span> : null}
          </div>
          <div className="text-[12px] text-ink-2">{stats.sessionsThisWeek === 1 ? "workout" : "workouts"} done</div>
        </Card>
        <Card className="flex flex-col gap-0.5 !p-3">
          <div className="text-[12px] text-ink-2">Total lifted, 7 days</div>
          <div className="font-display text-[24px] text-plum">
            {Math.round(kgToUnit(stats.thisWeek, unit)).toLocaleString()}
            <span className="text-[16px] text-ink-2"> {unit}</span>
          </div>
          <div className="text-[12px] text-ink-2">
            {stats.lastWeek > 0
              ? `${stats.thisWeek >= stats.lastWeek ? "+" : ""}${Math.round(((stats.thisWeek - stats.lastWeek) / stats.lastWeek) * 100)}% vs week before`
              : "sets × reps × weight"}
          </div>
        </Card>
      </div>
    </Page>
  );
}
