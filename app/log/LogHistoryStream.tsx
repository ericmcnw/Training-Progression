"use client";

import { useState } from "react";
import Link from "next/link";
import DeleteLogButton from "@/app/manual-log/DeleteLogButton";
import RoutineLogSummary from "@/app/components/RoutineLogSummary";
import type { LogSummaryData } from "@/lib/log-summary";
import { loadLogSummary } from "./log-summary-action";

export type LogHistoryRow = {
  id: string;
  routineId: string;
  name: string;
  typeLabel: string;
  summary: string;
  stripe: string;
  dateShort: string;
  time: string;
  editHref: string;
};

type DetailState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: LogSummaryData };

export default function LogHistoryStream({ rows }: { rows: LogHistoryRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, DetailState>>({});

  function toggle(row: LogHistoryRow) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });

    if (!details[row.id]) {
      setDetails((prev) => ({ ...prev, [row.id]: { status: "loading" } }));
      loadLogSummary(row.id)
        .then((data) => {
          setDetails((prev) => ({
            ...prev,
            [row.id]: data ? { status: "ready", data } : { status: "error" },
          }));
        })
        .catch(() => {
          setDetails((prev) => ({ ...prev, [row.id]: { status: "error" } }));
        });
    }
  }

  if (rows.length === 0) {
    return (
      <div className="logHistoryStream" style={{ opacity: 0.7, padding: 8 }}>
        No logs yet. Sessions you log will show up here.
      </div>
    );
  }

  return (
    <div className="logHistoryStream">
      {rows.map((row) => {
        const expanded = open.has(row.id);
        const detail = details[row.id];
        return (
          <div
            key={row.id}
            className="logHistoryRow"
            style={{ borderLeft: `3px solid ${row.stripe}` }}
          >
            <button
              type="button"
              onClick={() => toggle(row)}
              aria-expanded={expanded}
              className="logHistoryRowHead"
            >
              <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                <span
                  style={{
                    display: "block",
                    fontWeight: 800,
                    fontSize: 15,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.name}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    opacity: 0.62,
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.summary ? `${row.typeLabel} · ${row.summary}` : row.typeLabel}
                </span>
              </span>
              <span
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  fontWeight: 700,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {row.dateShort}
              </span>
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  fontSize: 12,
                  opacity: 0.6,
                  transform: expanded ? "rotate(90deg)" : "none",
                  transition: "transform 120ms ease",
                }}
              >
                ▶
              </span>
            </button>

            {expanded && (
              <div className="logHistoryRowBody">
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>{row.time}</div>

                {(!detail || detail.status === "loading") && (
                  <div style={{ fontSize: 13, opacity: 0.6 }}>Loading details…</div>
                )}
                {detail?.status === "error" && (
                  <div style={{ fontSize: 13, opacity: 0.7 }}>Couldn’t load details.</div>
                )}
                {detail?.status === "ready" && (
                  <div className="logHistoryDetail">
                    <RoutineLogSummary data={detail.data} />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Link href={row.editHref} style={editBtn}>
                    Edit
                  </Link>
                  <DeleteLogButton logId={row.id} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const editBtn: React.CSSProperties = {
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
