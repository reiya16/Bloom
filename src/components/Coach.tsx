import { useMemo, useState } from "react";
import { useAppData } from "@/state/AppData";
import { computeAlerts } from "@/lib/coachRules";
import ChatPanel from "./ChatPanel";
import { Tag, Title } from "./ui";

interface Props {
  /** A question sent from another screen (for example "Ask Coach" on Today). */
  autoSend: { id: number; text: string } | null;
  onAutoSent: () => void;
}

const KIND_LABEL: Record<string, string> = { stall: "Stalled", consistency: "Consistency", protein: "Nutrition", calories: "Nutrition", carbs: "Nutrition", fat: "Nutrition" };

export default function Coach({ autoSend, onAutoSent }: Props) {
  const { sessions, exerciseById, profile, foodLog } = useAppData();
  const alerts = useMemo(() => computeAlerts({ sessions, exerciseById, profile, foodLog }), [sessions, exerciseById, profile, foodLog]);
  const [local, setLocal] = useState<{ id: number; text: string } | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-2 pt-6">
        <Title size={32}>Coach</Title>
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-col gap-1.5 pb-2">
          <div className="px-5 text-[13px] font-medium text-ink-2">
            {alerts.length} {alerts.length === 1 ? "thing" : "things"} worth a look
          </div>
          <div className="flex gap-2.5 overflow-x-auto px-5 pb-1">
            {alerts.map((a) => (
              <div key={a.id} className="flex w-[260px] flex-shrink-0 flex-col gap-1 rounded-card border border-line bg-surface p-3">
                <div>
                  <Tag tone={a.kind === "stall" ? "accent" : "warn"}>{KIND_LABEL[a.kind]}</Tag>
                </div>
                <div className="text-[14px] font-bold leading-snug">{a.title}</div>
                <div className="text-[13px] leading-snug text-ink-2">{a.detail}</div>
                <button onClick={() => setLocal({ id: Date.now(), text: a.ask })} className="mt-auto min-h-[44px] self-start text-[14px] font-bold text-plum">
                  Ask Coach
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ChatPanel
        thread="coach"
        intro="Hi, I'm Coach. I can see your plan, your recent workouts and what you've eaten. Ask me anything, or tap one of these to start. To answer, Coach shares that information with Google's Gemini AI."
        suggestions={["How's my week going?", "Which lifts have stalled?", "Suggest a swap for an exercise I dislike", "Is my protein on track?"]}
        autoSend={local ?? autoSend}
        onAutoSent={() => {
          setLocal(null);
          onAutoSent();
        }}
      />
    </div>
  );
}
