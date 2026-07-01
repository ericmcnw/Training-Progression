"use client";

import { useState, type CSSProperties } from "react";
import { setProfileIdentity } from "./identity-actions";
import type { ProfileIdentity } from "@/lib/profile-identity";

const EMOJIS = ["🏔", "🧗", "🏃", "🚴", "🏋️", "🏂", "🏄", "⛷️", "🎾", "⛳", "💪", "🔥"];
const COLORS = [
  "rgba(96,165,250,0.9)",
  "rgba(74,222,128,0.9)",
  "rgba(251,146,60,0.9)",
  "rgba(167,139,250,0.9)",
  "rgba(244,114,182,0.9)",
  "rgba(45,212,191,0.9)",
];

export default function IdentitySetting({ initial }: { initial: ProfileIdentity }) {
  const [name, setName] = useState(initial.displayName ?? "");
  const [emoji, setEmoji] = useState(initial.avatarEmoji ?? "🏔");
  const [color, setColor] = useState(initial.avatarColor ?? COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await setProfileIdentity({ displayName: name, avatarEmoji: emoji, avatarColor: color });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={card}>
      <div style={header}>PROFILE</div>
      <div style={{ padding: 14, display: "grid", gap: 14 }}>
        {/* Preview + name */}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ ...avatar, background: color }} aria-hidden>{emoji}</div>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            placeholder="Your name"
            style={input}
            maxLength={40}
            aria-label="Display name"
          />
        </div>

        {/* Emoji picker */}
        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Avatar</div>
          <div style={swatchRow}>
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { setEmoji(e); setSaved(false); }}
                style={{ ...emojiBtn, ...(e === emoji ? emojiBtnActive : null) }}
                aria-pressed={e === emoji}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Color</div>
          <div style={swatchRow}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setColor(c); setSaved(false); }}
                style={{ ...colorBtn, background: c, outline: c === color ? "2px solid rgba(255,255,255,0.9)" : "2px solid transparent" }}
                aria-label={`Color ${c}`}
                aria-pressed={c === color}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={save} disabled={busy} style={saveBtn}>
            {busy ? "Saving…" : "Save"}
          </button>
          {saved ? <span style={savedNote}>Saved ✓</span> : null}
        </div>
      </div>
    </div>
  );
}

const card: CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const header: CSSProperties = {
  padding: "8px 16px",
  background: "rgba(128,128,128,0.11)",
  borderBottom: "1px solid rgba(128,128,128,0.2)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
};

const avatar: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
  flexShrink: 0,
  border: "1px solid rgba(255,255,255,0.18)",
};

// fontSize 16 — iOS focus-zoom guard (CLAUDE.md rule 3a).
const input: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.25)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 700,
  outline: "none",
  boxSizing: "border-box",
};

const label: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.55,
};

const swatchRow: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };

const emojiBtn: CSSProperties = {
  width: 40,
  height: 40,
  minHeight: 40,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  fontSize: 20,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const emojiBtnActive: CSSProperties = {
  border: "1px solid rgba(84,203,130,0.8)",
  background: "rgba(84,203,130,0.16)",
};

const colorBtn: CSSProperties = {
  width: 32,
  height: 32,
  minHeight: 32,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
};

const saveBtn: CSSProperties = {
  padding: "9px 18px",
  borderRadius: 10,
  border: "1px solid rgba(84,203,130,0.75)",
  background: "rgba(84,203,130,0.18)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  minHeight: 40,
};

const savedNote: CSSProperties = { fontSize: 12.5, fontWeight: 800, color: "rgba(84,203,130,0.95)" };
