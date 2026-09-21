export type TabId = "today" | "train" | "eat" | "progress" | "coach";

const TABS: { id: TabId; label: string; icon: JSX.Element }[] = [
  {
    id: "today",
    label: "Today",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    )
  },
  { id: "train", label: "Train", icon: <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /> },
  {
    id: "eat",
    label: "Eat",
    icon: (
      <>
        <path d="M12 7c-2-2-6-1.5-6 3 0 4 3 9 6 9s6-5 6-9c0-4.5-4-5-6-3z" />
        <path d="M12 7c0-2 1-3 3-4" />
      </>
    )
  },
  {
    id: "progress",
    label: "Progress",
    icon: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </>
    )
  },
  { id: "coach", label: "Coach", icon: <path d="M4 5h16v11H9l-5 4z" /> }
];

export default function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav aria-label="Main" className="flex border-t border-line bg-surface px-2 pt-1.5" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 text-[12px] ${on ? "font-bold text-plum" : "font-medium text-ink-2"}`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {t.icon}
            </svg>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
