import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

// ── Small building blocks used across Bloom ─────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  full = true,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; full?: boolean }) {
  const base = "inline-flex items-center justify-center rounded-full font-bold transition-opacity disabled:opacity-50";
  const styles: Record<ButtonVariant, string> = {
    primary: "min-h-[52px] bg-accent px-6 text-[16px] text-accent-ink",
    secondary: "min-h-[48px] border border-plum bg-transparent px-5 text-[15px] text-plum",
    ghost: "min-h-[44px] px-3 text-[14px] text-plum",
    danger: "min-h-[48px] bg-danger px-5 text-[15px] text-white"
  };
  return <button {...props} className={`${base} ${styles[variant]} ${full ? "w-full" : ""} ${className}`} />;
}

export function Title({ children, size = 30 }: { children: ReactNode; size?: number }) {
  return (
    <h1 className="font-display leading-[1.1] text-plum" style={{ fontSize: size }}>
      {children}
    </h1>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[13px] font-bold uppercase tracking-[0.06em] text-accent">{children}</div>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-surface p-4 ${className}`}>{children}</div>;
}

export function Muted({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[14px] leading-snug text-ink-2 ${className}`}>{children}</div>;
}

export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="-ml-1 flex min-h-[44px] items-center gap-0.5 self-start text-[14px] font-bold text-plum">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {label}
    </button>
  );
}

/** One big tappable option with a title and a short explanation. */
export function RadioCard({
  selected,
  title,
  blurb,
  onSelect
}: {
  selected: boolean;
  title: string;
  blurb?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-md2 px-3.5 py-3 text-left ${
        selected ? "border-2 border-plum bg-plum-bg" : "border border-line bg-surface"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-plum" : "border-line-3"
        }`}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-plum" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={`text-[15px] font-bold ${selected ? "text-plum" : ""}`}>{title}</span>
        {blurb && <span className="text-[13px] leading-snug text-ink-2">{blurb}</span>}
      </span>
    </button>
  );
}

/** Row of pill choices (like kg | lb). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label
}: {
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-full px-3 text-[14px] ${
              on ? "border-2 border-plum bg-plum-bg font-bold text-plum" : "border border-line bg-surface"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ selected, children, onClick }: { selected?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[44px] flex-shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[14px] ${
        selected ? "bg-plum font-bold text-bg" : "border border-line bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

export function Tag({ children, tone = "plum" }: { children: ReactNode; tone?: "plum" | "success" | "warn" | "accent" }) {
  const tones = {
    plum: "bg-plum-bg text-plum",
    success: "bg-success-bg text-success",
    warn: "bg-warn-bg text-warn",
    accent: "bg-accent-bg text-accent"
  };
  return <span className={`rounded-lg px-2 py-0.5 text-[12px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function Field({
  label,
  suffix,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; suffix?: string }) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-bold">
        {label}
      </label>
      <div className="flex min-h-[48px] items-center rounded-md2 border border-line-2 bg-surface px-3.5 focus-within:border-plum">
        <input id={id} {...props} className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none" />
        {suffix && <span className="text-[14px] text-ink-2">{suffix}</span>}
      </div>
    </div>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  label
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const btn = "flex h-11 w-11 items-center justify-center rounded-full border border-line-2 bg-surface text-[22px] font-bold text-plum disabled:opacity-40";
  return (
    <div className="flex items-center gap-3.5">
      <button aria-label={`Fewer ${label}`} className={btn} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <div className="min-w-[24px] text-center font-display text-[26px] text-plum">{value}</div>
      <button aria-label={`More ${label}`} className={btn} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

/** Slide-up panel over the current screen. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-bg px-5 pb-8 pt-3"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-3" />
        <h2 className="mb-3 font-display text-2xl text-plum">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-ink-3">{label}</div>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-md2 bg-danger-bg px-3 py-2 text-[13px] text-danger">{children}</p>;
}

/** Scrollable page with standard padding. */
export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex h-full flex-col gap-4 overflow-y-auto px-5 pb-8 pt-6 ${className}`}>{children}</div>
  );
}
