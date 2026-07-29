"use client";

// Slice-1 coach chat. Streams NDJSON events from /api/coach and renders a
// phone-first conversation. No persistence yet (Slice 3) — a refresh starts a
// fresh conversation by design.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";

const KEY_STORAGE = "coachPassphrase";

const TOOL_LABELS: Record<string, string> = {
  get_recent_logs: "Reading your training log…",
  get_pain_trend: "Reading your pain trend…",
};

const STARTERS = [
  "What should I do today?",
  "How is my hamstring trending?",
  "Did last week's load settle okay?",
];

type ChatMessage = { role: "user" | "assistant"; content: string; failed?: boolean };

export default function CoachChat({
  configured,
  variant = "page",
}: {
  configured: boolean;
  /** "page" renders its own header + viewport height; "fill" stretches to
   *  the parent (the floating-widget sheet supplies the chrome). */
  variant?: "page" | "fill";
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [streamText, setStreamText] = useState<string | null>(null);
  const [toolNote, setToolNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [needKey, setNeedKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const retryRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText, toolNote]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Restore the latest conversation on open — chats survive refresh now.
  useEffect(() => {
    if (!configured) return;
    const key = localStorage.getItem(KEY_STORAGE) ?? "";
    if (!key) return;
    let cancelled = false;
    fetch("/api/coach", { headers: { "x-coach-key": key } })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { threadId: string | null; messages: ChatMessage[] };
        if (cancelled || !data.threadId) return;
        setThreadId((prev) => prev ?? data.threadId);
        setMessages((prev) => (prev.length ? prev : data.messages));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [configured]);

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setStreamText(null);
    setToolNote(null);
    setPending(false);
    setThreadId("new");
  }

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || pending) return;

    const key = (typeof window !== "undefined" && localStorage.getItem(KEY_STORAGE)) || "";
    if (!key) {
      retryRef.current = content;
      setNeedKey(true);
      return;
    }

    const history = [...messages.filter((m) => !m.failed), { role: "user" as const, content }];
    setMessages(history);
    setDraft("");
    setPending(true);
    setStreamText(null);
    setToolNote(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let assistantText = "";
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-coach-key": key },
        body: JSON.stringify({ message: content, threadId: threadId ?? undefined }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        retryRef.current = content;
        setMessages(messages);
        setDraft(content);
        setNeedKey(true);
        return;
      }
      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => null);
        throw new Error((detail as { error?: string } | null)?.error ?? "Coach request failed.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: { type?: string; text?: string; name?: string; message?: string; threadId?: string };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "text" && evt.text) {
            assistantText += evt.text;
            setToolNote(null);
            setStreamText(assistantText);
          } else if (evt.type === "meta" && evt.threadId) {
            setThreadId(evt.threadId);
          } else if (evt.type === "tool") {
            setToolNote(TOOL_LABELS[evt.name ?? ""] ?? "Looking things up…");
          } else if (evt.type === "error") {
            throw new Error(evt.message ?? "Coach request failed.");
          }
        }
      }

      setMessages([...history, { role: "assistant", content: assistantText.trim() || "(no reply)" }]);
    } catch (err) {
      if (controller.signal.aborted) return;
      const note = err instanceof Error && err.message ? err.message : "Coach request failed.";
      setMessages([
        ...history,
        {
          role: "assistant",
          content: assistantText ? `${assistantText}\n\n(${note})` : `${note} Try again in a moment.`,
          failed: !assistantText,
        },
      ]);
    } finally {
      setPending(false);
      setStreamText(null);
      setToolNote(null);
    }
  }

  function saveKey() {
    const trimmed = keyDraft.trim();
    if (!trimmed) return;
    localStorage.setItem(KEY_STORAGE, trimmed);
    setKeyDraft("");
    setNeedKey(false);
    const retry = retryRef.current;
    retryRef.current = null;
    if (retry) void send(retry);
  }

  const rootStyle = variant === "fill" ? fillStyle : pageStyle;

  if (!configured) {
    return (
      <div style={rootStyle}>
        {variant === "page" ? <Header /> : null}
        <div style={panelStyle}>
          The coach isn&apos;t configured on this deployment yet — set{" "}
          <code>ANTHROPIC_API_KEY</code> and <code>COACH_SECRET</code>, then redeploy.
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      {variant === "page" ? <Header /> : null}

      <div ref={scrollRef} style={threadStyle}>
        {messages.length > 0 ? (
          <button type="button" style={newChatStyle} onClick={newChat}>
            ↺ New chat
          </button>
        ) : null}
        {messages.length === 0 && !pending ? (
          <div style={emptyStyle}>
            <div style={{ fontSize: 34 }}>🧠</div>
            <div style={{ fontWeight: 700 }}>Your coach knows your case</div>
            <div style={{ color: "var(--muted)", fontSize: 14, maxWidth: 420 }}>
              It reads your real logs and pain trend before answering. Nothing is logged on your
              behalf — it reads and advises.
            </div>
            <div style={starterWrapStyle}>
              {STARTERS.map((s) => (
                <button key={s} type="button" style={starterChipStyle} onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} style={m.role === "user" ? userBubbleStyle : coachBubbleStyle}>
            {m.content}
          </div>
        ))}
        {streamText != null ? <div style={coachBubbleStyle}>{streamText}</div> : null}
        {toolNote ? <div style={toolNoteStyle}>📊 {toolNote}</div> : null}
        {pending && streamText == null && !toolNote ? <div style={toolNoteStyle}>Thinking…</div> : null}
      </div>

      {needKey ? (
        <div style={keyGateStyle}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Enter your coach passphrase (the <code>COACH_SECRET</code> you configured). Saved on
            this device.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveKey();
              }}
              placeholder="Passphrase"
              style={{ ...inputStyle, flex: 1 }}
              autoFocus
            />
            <button type="button" style={sendButtonStyle} onClick={saveKey}>
              Save
            </button>
          </div>
        </div>
      ) : null}

      <div style={composerStyle} className="coachComposer">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              void send(draft);
            }
          }}
          placeholder="Ask your coach…"
          rows={2}
          maxLength={7500}
          style={composerInputStyle}
        />
        <button
          type="button"
          style={pending || !draft.trim() ? { ...sendButtonStyle, opacity: 0.5 } : sendButtonStyle}
          disabled={pending || !draft.trim()}
          onClick={() => void send(draft)}
        >
          {pending ? "…" : "Send"}
        </button>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .coachComposer { padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
        }
      `}</style>
    </div>
  );
}

function Header() {
  return (
    <div style={headerStyle}>
      <Link href="/" style={backLinkStyle}>
        ‹ Home
      </Link>
      <div style={{ fontWeight: 800, fontSize: 17 }}>🧠 Coach</div>
      <div style={{ width: 52 }} aria-hidden />
    </div>
  );
}

const ACCENT = "rgba(251,191,36,0.9)";

const panelStyle: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
  fontSize: 14,
  lineHeight: 1.5,
  color: "var(--muted)",
};

const pageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  maxWidth: 760,
  margin: "0 auto",
  height: "calc(100dvh - var(--app-mobile-bottom-offset, 0px) - 70px)",
  minHeight: 420,
};

const fillStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  padding: "0 12px",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 4px",
};

const backLinkStyle: CSSProperties = {
  color: "var(--muted)",
  textDecoration: "none",
  fontSize: 14,
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
};

const threadStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "6px 4px 14px",
};

const bubbleBase: CSSProperties = {
  padding: "10px 13px",
  borderRadius: 14,
  fontSize: 15,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  maxWidth: "88%",
};

const userBubbleStyle: CSSProperties = {
  ...bubbleBase,
  alignSelf: "flex-end",
  background: "rgba(251,191,36,0.14)",
  border: "1px solid rgba(251,191,36,0.3)",
};

const coachBubbleStyle: CSSProperties = {
  ...bubbleBase,
  alignSelf: "flex-start",
  background: "var(--panel)",
  border: "1px solid var(--border)",
};

const newChatStyle: CSSProperties = {
  alignSelf: "flex-end",
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--muted)",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 13,
  minHeight: 32,
  cursor: "pointer",
};

const toolNoteStyle: CSSProperties = {
  alignSelf: "flex-start",
  color: "var(--muted)",
  fontSize: 13,
  padding: "2px 6px",
};

const emptyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: 8,
  margin: "auto 0",
  padding: "30px 10px",
};

const starterWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 8,
  marginTop: 8,
};

const starterChipStyle: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 14,
  minHeight: 44,
  cursor: "pointer",
};

const keyGateStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "10px 4px",
  borderTop: "1px solid var(--border)",
};

const composerStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-end",
  padding: "8px 4px 10px",
  borderTop: "1px solid var(--border)",
  background: "var(--bg)",
};

const composerInputStyle: CSSProperties = {
  flex: 1,
  fontSize: 16,
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--panel)",
  color: "var(--text)",
  resize: "none",
  minHeight: 44,
  maxHeight: 140,
};

const sendButtonStyle: CSSProperties = {
  background: "rgba(251,191,36,0.16)",
  border: `1px solid ${ACCENT}`,
  color: "var(--text)",
  fontWeight: 700,
  fontSize: 15,
  borderRadius: 12,
  padding: "0 18px",
  minHeight: 44,
  cursor: "pointer",
};
