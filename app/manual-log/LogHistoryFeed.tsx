"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { domainColor } from "@/lib/routines";
import DeleteLogButton from "./DeleteLogButton";

// Instant client-side search + filter over the FULL log history. Rows are
// pre-shaped server-side (display name, metric line, searchText) so this
// component just filters + groups by day. No round-trips per keystroke.

export type HistoryRow = {
  id: string;
  routineId: string;
  name: string;
  domain: string;
  typeLabel: string;
  dateKey: string; // app-local YMD, for grouping + header
  timeLabel: string;
  metricLine: string | null;
  notes: string | null;
  /** Lowercased name + notes + exercise names — the haystack for search. */
  searchText: string;
  editHref: string;
};

type DomainOption = { value: string; label: string };

export default function LogHistoryFeed({
  rows,
  domainOptions,
  initialDomain = "",
}: {
  rows: HistoryRow[];
  domainOptions: DomainOption[];
  initialDomain?: string;
}) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState(initialDomain);
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (domain && r.domain !== domain) return false;
      if (q && !r.searchText.includes(q)) return false;
      return true;
    });
  }, [rows, domain, q]);

  // Group filtered rows by day (rows arrive newest-first, so insertion order
  // of the Map preserves the date ordering).
  const groups = useMemo(() => {
    const byDate = new Map<string, HistoryRow[]>();
    for (const r of filtered) {
      const arr = byDate.get(r.dateKey);
      if (arr) arr.push(r);
      else byDate.set(r.dateKey, [r]);
    }
    return Array.from(byDate.entries());
  }, [filtered]);

  const isFiltering = q !== "" || domain !== "";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Search + count */}
      <div style={{ display: "grid", gap: 8 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search routines, exercises, notes…"
          style={searchInputStyle}
          aria-label="Search log history"
        />
        {/* Domain filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {domainOptions.map((opt) => {
            const active = domain === opt.value;
            const c = opt.value ? domainColor(opt.value) : null;
            return (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => setDomain(opt.value)}
                style={{
                  ...pillStyle,
                  background: active
                    ? c
                      ? c.replace("0.9)", "0.18)")
                      : "rgba(255,255,255,0.12)"
                    : "rgba(255,255,255,0.05)",
                  borderColor: active
                    ? c
                      ? c.replace("0.9)", "0.35)")
                      : "rgba(255,255,255,0.28)"
                    : "rgba(128,128,128,0.28)",
                }}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div style={countStyle}>
          {isFiltering
            ? `${filtered.length} of ${rows.length} log${rows.length === 1 ? "" : "s"}`
            : `${rows.length} log${rows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div style={{ opacity: 0.7, fontSize: 13, padding: "8px 2px" }}>
          {rows.length === 0 ? "No logs yet." : "No logs match your search."}
        </div>
      ) : (
        groups.map(([dateKey, dayLogs]) => (
          <div key={dateKey} style={{ display: "grid", gap: 8 }}>
            <div style={dateHeaderStyle}>
              {formatDateHeader(dateKey)} ({dayLogs.length})
            </div>
            {dayLogs.map((log) => {
              const color = domainColor(log.domain);
              return (
                <div
                  key={log.id}
                  className="mobileManualLogHistoryCard mobileCard"
                  style={{ ...historyCard, borderLeft: `3px solid ${color.replace("0.9)", "0.6)")}` }}
                >
                  <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{log.name}</div>
                    <div style={{ opacity: 0.7, marginTop: 2, fontSize: 12 }}>
                      {log.typeLabel} · {log.timeLabel}
                    </div>
                    {log.metricLine ? (
                      <div style={{ opacity: 0.8, marginTop: 2, fontSize: 12 }}>{log.metricLine}</div>
                    ) : null}
                    {log.notes ? (
                      <div style={{ opacity: 0.65, marginTop: 4, fontSize: 12 }}>{log.notes}</div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexShrink: 0 }}>
                    <Link href={log.editHref} style={miniLinkBtn}>Edit</Link>
                    <DeleteLogButton logId={log.id} />
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

// Header label from an app-local YMD. Noon-UTC anchor keeps the weekday/date
// correct for US viewers without re-deriving the app timezone client-side.
function formatDateHeader(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

// 16px font — iOS Safari focus-zoom guard.
const searchInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.6)",
  background: "#111827",
  color: "#ffffff",
  fontSize: 16,
};

const pillStyle: CSSProperties = {
  padding: "7px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  color: "inherit",
  borderWidth: 1,
  borderStyle: "solid",
  cursor: "pointer",
};

const countStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.5,
};

const dateHeaderStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  opacity: 0.55,
  textTransform: "uppercase",
};

const historyCard: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px 10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.22)",
  background: "rgba(255,255,255,0.02)",
};

const miniLinkBtn: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,0.5)",
  background: "rgba(128,128,128,0.1)",
  color: "inherit",
  fontSize: 11,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};
