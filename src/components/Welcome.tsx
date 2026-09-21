import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button, ErrorNote, PasswordField } from "./ui";

type Mode = "signin" | "signup" | "forgot";

export default function Welcome() {
  const { signInWithPassword, signUpWithPassword, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setError(null);
    setInfo(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    reset();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signInWithPassword(email, password);
      } else if (mode === "signup") {
        await signUpWithPassword(email, password);
        setInfo("Account created. If asked to confirm your email, check your inbox, then sign in.");
        setMode("signin");
      } else {
        await sendPasswordReset(email);
        setInfo("Check your email for a password reset link.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-6 pb-8 pt-[12dvh]">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[46px] leading-none text-plum">Bloom</h1>
        <p className="text-[17px] leading-snug text-ink-2">Training and nutrition, coached to your goals.</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[14px] font-bold">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="min-h-[48px] rounded-md2 border border-line-2 bg-surface px-3.5 text-ink outline-none focus:border-plum"
          />
        </div>

        {mode !== "forgot" && (
          <PasswordField
            label="Password"
            required
            minLength={6}
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        )}

        {mode === "signin" && (
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              reset();
            }}
            className="self-end text-[13px] text-ink-2 underline"
          >
            Forgot password?
          </button>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Please wait..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </Button>

        {error && <ErrorNote>{error}</ErrorNote>}
        {info && <p className="text-[13px] text-success">{info}</p>}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            reset();
          }}
          className="min-h-[44px] text-[14px] font-bold text-plum"
        >
          {mode === "signin" ? "New here? Create an account" : "Back to sign in"}
        </button>
      </form>

      <p className="mt-auto text-center text-[13px] leading-snug text-ink-2">
        Your workouts are saved to your own account, so they follow you to a new phone.
      </p>
    </div>
  );
}
