import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button, ErrorNote, Field, Muted, Page, Title } from "./ui";

/** Shown after someone taps the link in a "reset password" email. */
export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Page className="justify-center">
        <Title>Password updated</Title>
        <Muted>You&apos;re signed in with your new password.</Muted>
        <Button onClick={() => window.location.reload()}>Continue to Bloom</Button>
      </Page>
    );
  }

  return (
    <Page className="justify-center">
      <Title>Choose a new password</Title>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="New password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field label="Confirm new password" type="password" required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save password"}
        </Button>
      </form>
    </Page>
  );
}
