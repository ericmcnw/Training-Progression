// Spikeball "People & Records" — the per-sport metrics block on the
// Spikeball world page. Derives everything from each log's sportData
// (format + teammate / opponent1 / opponent2 + gamesPlayed / gamesWon),
// so it lights up automatically as games are logged. Server component —
// pure render, no interactivity.
//
//   • Overall win-rate ring + record / games / sessions.
//   • "Played with" — your record teaming up with each person.
//   • "Played against" — your record facing each person.

import { SectionCard } from "@/app/progress/ui";

type SpikeballStatsLog = { sportData: unknown };

type Tally = { name: string; sessions: number; games: number; won: number };

function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseExtras(sportData: unknown): {
  teammate: string | null;
  opponents: string[];
  games: number | null;
  won: number | null;
} | null {
  if (!sportData || typeof sportData !== "object" || Array.isArray(sportData)) return null;
  const sd = sportData as Record<string, unknown>;
  if (sd.sport !== "spikeball") return null;
  const extras = sd.extras;
  if (!extras || typeof extras !== "object") return null;
  const e = extras as Record<string, unknown>;
  return {
    teammate: cleanName(e.teammate),
    opponents: [cleanName(e.opponent1), cleanName(e.opponent2)].filter((n): n is string => Boolean(n)),
    games: toInt(e.gamesPlayed),
    won: toInt(e.gamesWon),
  };
}

function bump(map: Map<string, Tally>, name: string, games: number | null, won: number | null) {
  const t = map.get(name) ?? { name, sessions: 0, games: 0, won: 0 };
  t.sessions += 1;
  if (games != null) {
    t.games += games;
    if (won != null) t.won += Math.min(won, games);
  }
  map.set(name, t);
}

export default function SpikeballStats({
  logs,
  accent,
}: {
  logs: SpikeballStatsLog[];
  accent: string;
}) {
  const withMap = new Map<string, Tally>();
  const againstMap = new Map<string, Tally>();
  let totalGames = 0;
  let totalWon = 0;
  let sessionsWithGames = 0;
  let totalSessions = 0;

  for (const log of logs) {
    const x = parseExtras(log.sportData);
    if (!x) continue;
    totalSessions += 1;
    if (x.games != null && x.games > 0) {
      totalGames += x.games;
      sessionsWithGames += 1;
      if (x.won != null) totalWon += Math.min(x.won, x.games);
    }
    if (x.teammate) bump(withMap, x.teammate, x.games, x.won);
    for (const opp of x.opponents) bump(againstMap, opp, x.games, x.won);
  }

  // Nothing to show until at least one person or game has been logged.
  if (totalSessions === 0 || (withMap.size === 0 && againstMap.size === 0 && totalGames === 0)) {
    return null;
  }

  const sortTallies = (m: Map<string, Tally>) =>
    Array.from(m.values()).sort(
      (a, b) => b.games - a.games || b.sessions - a.sessions || a.name.localeCompare(b.name)
    );
  const withList = sortTallies(withMap);
  const againstList = sortTallies(againstMap);

  const overallPct = totalGames > 0 ? Math.round((totalWon / totalGames) * 100) : null;
  const overallLosses = totalGames - totalWon;

  return (
    <SectionCard
      title="People & Records"
      subtitle="Your win rate overall, and with and against everyone you've logged."
    >
      {/* ── Overall record hero ─────────────────────────────────────── */}
      <div style={heroCard(accent)}>
        <WinRing pct={overallPct} accent={accent} />
        <div style={heroStats}>
          <HeroStat label="Record" value={totalGames > 0 ? `${totalWon}–${overallLosses}` : "—"} accent={accent} />
          <HeroStat label="Games" value={totalGames > 0 ? String(totalGames) : "—"} accent={accent} />
          <HeroStat
            label="Sessions"
            value={String(totalSessions)}
            sub={sessionsWithGames < totalSessions ? `${sessionsWithGames} scored` : undefined}
            accent={accent}
          />
        </div>
      </div>

      {/* ── Played with ─────────────────────────────────────────────── */}
      {withList.length > 0 ? (
        <PersonGroup title="Played with" caption="Win rate teaming up" people={withList} accent={accent} />
      ) : null}

      {/* ── Played against ──────────────────────────────────────────── */}
      {againstList.length > 0 ? (
        <PersonGroup title="Played against" caption="Your win rate facing them" people={againstList} accent={accent} />
      ) : null}
    </SectionCard>
  );
}

// ── Win-rate ring (SVG) ───────────────────────────────────────────────────────

function WinRing({ pct, accent }: { pct: number | null; accent: string }) {
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = pct != null ? (pct / 100) * c : 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={stroke} />
        {pct != null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c - filled}`}
          />
        ) : null}
      </svg>
      <div style={ringCenter}>
        <span style={{ ...ringPct, color: pct != null ? accent : "rgba(255,255,255,0.5)" }}>
          {pct != null ? `${pct}%` : "—"}
        </span>
        <span style={ringSub}>win rate</span>
      </div>
    </div>
  );
}

function HeroStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={heroStatCell}>
      <span style={{ ...heroStatValue, color: accent }}>{value}</span>
      <span style={heroStatLabel}>{label}</span>
      {sub ? <span style={heroStatSub}>{sub}</span> : null}
    </div>
  );
}

// ── Per-person leaderboard ────────────────────────────────────────────────────

function PersonGroup({
  title,
  caption,
  people,
  accent,
}: {
  title: string;
  caption: string;
  people: Tally[];
  accent: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={groupHeaderRow}>
        <span style={groupTitle}>{title}</span>
        <span style={groupCaption}>{caption}</span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {people.map((p) => (
          <PersonRow key={p.name} person={p} accent={accent} />
        ))}
      </div>
    </div>
  );
}

// Win rate always counts YOUR wins, so a fuller bar = better for you in
// both the "with" and "against" groups — they read the same way.
function PersonRow({ person, accent }: { person: Tally; accent: string }) {
  const pct = person.games > 0 ? Math.round((person.won / person.games) * 100) : null;
  const losses = person.games - person.won;
  return (
    <div style={personRow}>
      <div style={personTopRow}>
        <span style={personName}>{person.name}</span>
        <span style={personRecord}>
          {person.games > 0 ? (
            <>
              <b style={{ color: "rgba(74,222,128,0.95)" }}>{person.won}</b>
              <span style={{ opacity: 0.4 }}>–</span>
              <b style={{ color: "rgba(248,113,113,0.95)" }}>{losses}</b>
            </>
          ) : (
            <span style={{ opacity: 0.5, fontSize: 11, fontWeight: 700 }}>no games scored</span>
          )}
        </span>
      </div>
      <div style={barTrack}>
        <div
          style={{
            height: "100%",
            width: `${pct ?? 0}%`,
            borderRadius: 999,
            background: accent,
            minWidth: pct != null && pct > 0 ? 4 : 0,
            transition: "width 200ms ease",
          }}
        />
      </div>
      <div style={personMetaRow}>
        <span style={personMeta}>
          {person.sessions} session{person.sessions === 1 ? "" : "s"}
          {person.games > 0 ? ` · ${person.games} game${person.games === 1 ? "" : "s"}` : ""}
        </span>
        <span style={{ ...personPct, color: pct != null ? accent : "rgba(255,255,255,0.4)" }}>
          {pct != null ? `${pct}%` : "—"}
        </span>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function softAccent(accent: string, alpha: string) {
  return accent.replace("0.9)", `${alpha})`);
}

function heroCard(accent: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 14,
    border: `1px solid ${softAccent(accent, "0.3")}`,
    background: `linear-gradient(180deg, ${softAccent(accent, "0.1")}, rgba(255,255,255,0.02))`,
  };
}

const ringCenter: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeContent: "center",
  textAlign: "center",
  gap: 0,
};

const ringPct: React.CSSProperties = { fontSize: 22, fontWeight: 950, lineHeight: 1 };
const ringSub: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
  marginTop: 2,
};

const heroStats: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
  flex: 1,
  minWidth: 0,
};

const heroStatCell: React.CSSProperties = { display: "grid", gap: 1, textAlign: "center", minWidth: 0 };
const heroStatValue: React.CSSProperties = { fontSize: 20, fontWeight: 950, lineHeight: 1.05 };
const heroStatLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
};
const heroStatSub: React.CSSProperties = { fontSize: 9, fontWeight: 700, opacity: 0.45 };

const groupHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  marginTop: 4,
};
const groupTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};
const groupCaption: React.CSSProperties = { fontSize: 11, opacity: 0.55, fontWeight: 700 };

const personRow: React.CSSProperties = {
  display: "grid",
  gap: 5,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.025)",
};
const personTopRow: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
};
const personName: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};
const personRecord: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  fontVariantNumeric: "tabular-nums",
  display: "inline-flex",
  gap: 3,
  flexShrink: 0,
};
const barTrack: React.CSSProperties = {
  height: 7,
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  overflow: "hidden",
};
const personMetaRow: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
};
const personMeta: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, opacity: 0.55 };
const personPct: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  fontVariantNumeric: "tabular-nums",
};
