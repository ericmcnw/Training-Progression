"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { domainColor } from "@/lib/routines";
import DeleteLogButton from "@/app/manual-log/DeleteLogButton";
import RoutineLogSummary from "@/app/components/RoutineLogSummary";
import type { LogSummaryData } from "@/lib/log-summary";
import { loadLogSummary } from "./log-summary-action";

export type HistoryRow = {
  id: string;
  routineId: string;
  name: string;
  domain: string;
  typeLabel: string;
  dateKey: string;
  timeLabel: string;
  metricLine: string | null;
  venueLabel: string | null;
  venueGlyph: string | null;
  searchText: string;
  editHref: string;
};

type DomainOption = { value: string; label: string };

type DetailState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: LogSummaryData };

const PAGE_SIZE = 100;
const OPEN_KEY = "logHistory.open";

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
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () => rows.filter((r) => (!domain || r.domain === domain) && (!q || r.searchText.includes(q))),
    [rows, domain, q],
  );

  const groups = useMemo(() => {
    const byDate = new Map<string, HistoryRow[]>();
    for (const r of filtered.slice(0, limit)) {
      const arr = byDate.get(r.dateKey);
      if (arr) arr.push(r);
      else byDate.set(r.dateKey, [r]);
    }
    return Array.from(byDate.entries());
  }, [filtered, limit]);

  const isFiltering = q !== "" || domain !== "";

  function loadDetail(id: string) {
    setDetails((prev) => ({ ...prev, [id]: { status: "loading" } }));
    loadLogSummary(id)
      .then((data) => {
        setDetails((prev) => ({ ...prev, [id]: data ? { status: "ready", data } : { status: "error" } }));
      })
      .catch(() => {
        setDetails((prev) => ({ ...prev, [id]: { status: "error" } }));
      });
  }

  // Rows left open are restored after following a link out and coming back.
  useEffect(() => {
    let saved: string[] = [];
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(OPEN_KEY) ?? "[]");
      if (Array.isArray(parsed)) saved = parsed.filter((id): id is string => typeof id === "string");
    } catch {
      saved = [];
    }
    const known = new Set(rows.map((r) => r.id));
    const ids = saved.filter((id) => known.has(id));
    if (ids.length === 0) return;
    setOpen(new Set(ids));
    ids.forEach(loadDetail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(row: HistoryRow) {
    const next = new Set(open);
    if (next.has(row.id)) next.delete(row.id);
    else next.add(row.id);
    setOpen(next);
    try {
      sessionStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
    } catch {}
    if (!details[row.id]) loadDetail(row.id);
  }

  if (rows.length === 0) {
    return (
      <div style={{ opacity: 0.7, padding: 8 }}>
        No logs yet. Sessions you log will show up here.{" "}
        <Link href="/log" style={{ color: "inherit", fontWeight: 800 }}>
          Log something →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder="Search routines, exercises, notes, places…"
          style={searchInput}
          aria-label="Search log history"
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {domainOptions.map((opt) => {
            const active = domain === opt.value;
            const c = opt.value ? domainColor(opt.value) : null;
            return (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => {
                  setDomain(opt.value);
                  setLimit(PAGE_SIZE);
                }}
                style={{
                  ...pill,
                  background: active ? (c ? c.replace("0.9)", "0.18)") : "rgba(255,255,255,0.12)") : "rgba(255,255,255,0.05)",
                  borderColor: active ? (c ? c.replace("0.9)", "0.35)") : "rgba(255,255,255,0.28)") : "rgba(128,128,128,0.28)",
                }}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div style={count}>
          {isFiltering
            ? `${filtered.length} of ${rows.length} log${rows.length === 1 ? "" : "s"}`
            : `${rows.length} log${rows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ opacity: 0.7, fontSize: 13, padding: "8px 2px" }}>No logs match your search.</div>
      ) : (
        groups.map(([dateKey, dayLogs]) => (
          <div key={dateKey} style={{ display: "grid", gap: 8 }}>
            <div style={dateHeader}>{formatDateHeader(dateKey)}</div>
            {dayLogs.map((row) => {
              const expanded = open.has(row.id);
              const detail = details[row.id];
              return (
                <div
                  key={row.id}
                  className="logHistoryRow"
                  style={{ borderLeft: `3px solid ${domainColor(row.domain).replace("0.9)", "0.6)")}` }}
                >
                  <button type="button" onClick={() => toggle(row)} aria-expanded={expanded} className="logHistoryRowHead">
                    <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                      <span style={rowName}>{row.name}</span>
                      <span style={rowSub}>{row.metricLine ? `${row.typeLabel} · ${row.metricLine}` : row.typeLabel}</span>
                      {row.venueLabel ? (
                        <span style={rowSub}>
                          {row.venueGlyph ?? "📍"} {row.venueLabel}
                        </span>
                      ) : null}
                    </span>
                    <span style={rowTime}>{row.timeLabel}</span>
                    <span aria-hidden style={{ ...chevron, transform: expanded ? "rotate(90deg)" : "none" }}>
                      ▶
                    </span>
                  </button>

                  {expanded ? (
                    <div className="logHistoryRowBody">
                      {!detail || detail.status === "loading" ? (
                        <div style={{ fontSize: 13, opacity: 0.6 }}>Loading details…</div>
                      ) : null}
                      {detail?.status === "error" ? (
                        <div style={{ fontSize: 13, opacity: 0.7 }}>Couldn’t load details.</div>
                      ) : null}
                      {detail?.status === "ready" ? (
                        <div className="logHistoryDetail">
                          <RoutineLogSummary data={detail.data} />
                        </div>
                      ) : null}
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <Link href={row.editHref} style={editBtn}>
                          Edit
                        </Link>
                        <DeleteLogButton logId={row.id} />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))
      )}

      {filtered.length > limit ? (
        <button type="button" onClick={() => setLimit((n) => n + PAGE_SIZE)} style={moreBtn}>
          Show older ({filtered.length - limit} more)
        </button>
      ) : null}
    </div>
  );
}

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

const searchInput: CSSProperties = {
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

const pill: CSSProperties = {
  padding: "7px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  color: "inherit",
  borderWidth: 1,
  borderStyle: "solid",
  cursor: "pointer",
};

const count: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.5 };

const dateHeader: CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 0.6, opacity: 0.55, textTransform: "uppercase" };

const rowName: CSSProperties = {
  display: "block",
  fontWeight: 800,
  fontSize: 15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowSub: CSSProperties = {
  display: "block",
  fontSize: 12,
  opacity: 0.62,
  marginTop: 2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowTime: CSSProperties = { fontSize: 12, opacity: 0.7, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" };

const chevron: CSSProperties = { flexShrink: 0, fontSize: 12, opacity: 0.6, transition: "transform 120ms ease" };

const editBtn: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.55)",
  borderRadius: 10,
  textAlign: "center",
  textDecoration: "none",
  color: "inherit",
  background: "rgba(128,128,128,0.12)",
  fontWeight: 700,
  fontSize: 13,
};

const moreBtn: CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.4)",
  background: "rgba(128,128,128,0.1)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};
