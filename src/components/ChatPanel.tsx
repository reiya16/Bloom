import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAppData } from "@/state/AppData";
import { askCoach } from "@/lib/functions";
import { describeChange, planLines } from "@/lib/proposals";
import type { CoachMessage, CoachThread, Proposal } from "@/lib/types";
import { Button, ErrorNote } from "./ui";

interface Props {
  thread: CoachThread;
  intro: string;
  suggestions: string[];
  placeholder?: string;
  /** Sends this message once (used by "Ask Coach" buttons elsewhere in the app). */
  autoSend?: { id: number; text: string } | null;
  onAutoSent?: () => void;
  /** Runs after the person applied a proposal. */
  onApplied?: (p: Proposal) => void;
}

export default function ChatPanel({ thread, intro, suggestions, placeholder = "Ask Coach anything", autoSend, onAutoSent, onApplied }: Props) {
  const { userId, applyProposal } = useAppData();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { applied: string[]; skipped: string[] }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("coach_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("thread", thread)
      .order("created_at", { ascending: true })
      .limit(80);
    if (err) throw new Error(err.message);
    setMessages((data ?? []) as CoachMessage[]);
  }, [userId, thread]);

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the conversation."))
      .finally(() => setLoaded(true));
  }, [reload]);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  const send = useCallback(
    async (raw: string) => {
      const msg = raw.trim();
      if (!msg || sending) return;
      setError(null);
      setSending(true);
      setText("");
      const temp: CoachMessage = { id: `temp-${Date.now()}`, thread, role: "user", content: msg, proposal: null, proposal_status: null, created_at: new Date().toISOString() };
      setMessages((m) => [...m, temp]);
      try {
        await askCoach(msg, thread);
        await reload();
      } catch (e) {
        setMessages((m) => m.filter((x) => x.id !== temp.id));
        setText(msg);
        setError(e instanceof Error ? e.message : "Coach ran into a problem.");
      } finally {
        setSending(false);
      }
    },
    [sending, thread, reload]
  );

  // "Ask Coach" from another screen
  const lastAuto = useRef<number | null>(null);
  useEffect(() => {
    if (autoSend && loaded && lastAuto.current !== autoSend.id) {
      lastAuto.current = autoSend.id;
      onAutoSent?.();
      void send(autoSend.text);
    }
  }, [autoSend, loaded, send, onAutoSent]);

  async function setStatus(m: CoachMessage, status: "applied" | "dismissed") {
    const { error: err } = await supabase.from("coach_messages").update({ proposal_status: status }).eq("id", m.id);
    if (err) throw new Error(err.message);
    setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, proposal_status: status } : x)));
  }

  async function apply(m: CoachMessage) {
    if (!m.proposal) return;
    setBusyId(m.id);
    setError(null);
    try {
      const r = await applyProposal(m.proposal);
      setResults((all) => ({ ...all, [m.id]: r }));
      await setStatus(m, "applied");
      onApplied?.(m.proposal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply the changes.");
    } finally {
      setBusyId(null);
    }
  }

  async function clear() {
    setConfirmClear(false);
    const { error: err } = await supabase.from("coach_messages").delete().eq("user_id", userId).eq("thread", thread);
    if (err) setError(err.message);
    else setMessages([]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        <div className="flex flex-col gap-3 py-2">
          {loaded && messages.length === 0 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-card bg-plum-bg px-4 py-3 text-[15px] leading-snug">{intro}</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="min-h-[44px] rounded-full border border-line-2 bg-surface px-4 text-left text-[14px]">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ml-10 self-end rounded-2xl rounded-br-md bg-plum px-4 py-2.5 text-[15px] leading-snug text-bg">
                {m.content}
              </div>
            ) : (
              <div key={m.id} className="mr-6 flex flex-col gap-2 self-start">
                <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-2.5 text-[15px] leading-snug">{m.content}</div>
                {m.proposal && (
                  <div className="flex flex-col gap-2 rounded-card border-2 border-plum bg-surface p-3.5">
                    <div className="text-[13px] font-bold uppercase tracking-wide text-accent">Suggested change</div>
                    <div className="font-display text-[19px] leading-tight text-plum">{m.proposal.title}</div>
                    {m.proposal.summary && <div className="text-[14px] text-ink-2">{m.proposal.summary}</div>}
                    <ul className="flex flex-col gap-1.5 text-[14px]">
                      {m.proposal.changes.map((c, i) => (
                        <li key={i} className="flex flex-col gap-0.5 border-t border-line pt-1.5">
                          <span>{describeChange(c)}</span>
                          {planLines(c).map((l) => (
                            <span key={l} className="text-[13px] text-ink-2">
                              {l}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                    {m.proposal_status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <Button className="!min-h-[46px] !text-[15px]" disabled={busyId === m.id} onClick={() => apply(m)}>
                          {busyId === m.id ? "Applying..." : "Apply"}
                        </Button>
                        <Button variant="secondary" full={false} disabled={busyId === m.id} className="!min-h-[46px]" onClick={() => setStatus(m, "dismissed").catch((e) => setError(String(e.message ?? e)))}>
                          Not now
                        </Button>
                      </div>
                    )}
                    {m.proposal_status === "applied" && (
                      <div className="text-[13px] font-bold text-success">
                        Applied
                        {results[m.id]?.skipped.length ? <span className="font-normal text-ink-2"> · skipped: {results[m.id].skipped.join("; ")}</span> : null}
                      </div>
                    )}
                    {m.proposal_status === "dismissed" && <div className="text-[13px] text-ink-2">Dismissed. Nothing was changed.</div>}
                  </div>
                )}
              </div>
            )
          )}
          {sending && <div className="mr-6 self-start rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-2.5 text-[15px] text-ink-2">Coach is thinking...</div>}
          <div ref={bottom} />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line bg-bg px-5 pb-3 pt-2.5">
        {error && <ErrorNote>{error}</ErrorNote>}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <textarea
            aria-label="Message to Coach"
            rows={1}
            maxLength={1500}
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
            className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink outline-none focus:border-plum"
          />
          <Button type="submit" full={false} disabled={sending || !text.trim()} className="!min-h-[48px]">
            Send
          </Button>
        </form>
        <div className="flex items-center justify-between text-[12px] text-ink-2">
          <span>General fitness guidance, not medical advice.</span>
          {messages.length > 0 &&
            (confirmClear ? (
              <span className="flex items-center gap-1">
                Clear chat?
                <button onClick={clear} className="min-h-[36px] px-1.5 font-bold text-danger">
                  Yes
                </button>
                <button onClick={() => setConfirmClear(false)} className="min-h-[36px] px-1.5 font-bold text-plum">
                  No
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="min-h-[36px] px-1 font-bold text-plum">
                Clear chat
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
