"use client";

// Read-only sibling of LogDrawer. Opens when the user taps "view →" on a
// routine that's already been logged for that day. Fetches every log id in
// the active set in one batch round trip and renders a stacked summary
// (one card per log) — so two walks logged the same day show both.
//
// Deliberately built as a separate component from LogDrawer so the edit
// state (dirty tracking, draft cache, kind-specific form mounting) stays
// isolated. Both share the same `.logDrawerBackdrop` / `.logDrawerSheet`
// CSS classes so the responsive sheet-on-mobile / modal-on-desktop
// behavior comes for free.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RoutineLogSummary from "@/app/components/RoutineLogSummary";
import { useViewLogDrawer } from "@/app/contexts/ViewLogDrawerContext";
import { useEditLogDrawer } from "@/app/contexts/EditLogDrawerContext";
import { deleteRoutineLog } from "@/app/routines/actions";
import { formatAppDateTime } from "@/lib/dates";
import type { LogSummaryData } from "@/lib/log-summary";

type FetchState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; logs: LogSummaryData[] };

export default function ViewLogDrawer() {
  const { isOpen, activeLogIds, title, closeViewer, notifyDeleted } = useViewLogDrawer();
  const { openEditDrawer } = useEditLogDrawer();
  if (!isOpen) return null;
  // Key the inner shell on the active id set. Switching routines while the
  // modal is open (or reopening after a delete) remounts with fresh state —
  // no lingering deletedIds, flash, or in-flight fetch.
  return (
    <ViewLogDrawerInner
      key={activeLogIds.join(",")}
      activeLogIds={activeLogIds}
      title={title}
      closeViewer={closeViewer}
      notifyDeleted={notifyDeleted}
      openEditDrawer={openEditDrawer}
    />
  );
}

function ViewLogDrawerInner({
  activeLogIds,
  title,
  closeViewer,
  notifyDeleted,
  openEditDrawer,
}: {
  activeLogIds: string[];
  title: string | null;
  closeViewer: () => void;
  notifyDeleted: (logId: string) => void;
  openEditDrawer: (logId: string, options?: { title?: string }) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<FetchState>(() =>
    activeLogIds.length === 0 ? { kind: "ready", logs: [] } : { kind: "loading" }
  );
  const [retryNonce, setRetryNonce] = useState(0);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeLogIds.length === 0) return;
    const controller = new AbortController();
    let cancelled = false;

    const idsParam = encodeURIComponent(activeLogIds.join(","));
    fetch(`/api/logs/summary?ids=${idsParam}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json() as Promise<{ logs: LogSummaryData[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setState({ kind: "ready", logs: data.logs });
      })
      .catch((err) => {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setState({ kind: "error", message: "Could not load log." });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeLogIds, retryNonce]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeViewer();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeViewer]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const handleDelete = useCallback(
    async (log: LogSummaryData) => {
      const confirmed = window.confirm(
        `Delete this ${log.routine.name} log? This can't be undone.`
      );
      if (!confirmed) return;

      try {
        await deleteRoutineLog(log.id);
      } catch {
        setFlash("Could not delete log.");
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 3000);
        return;
      }

      notifyDeleted(log.id);
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.add(log.id);
        return next;
      });
      setFlash("Log deleted");
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 2200);

      // Refresh the dashboard so the WaG count + planned/logged state
      // reflects the deletion next time the user closes the modal.
      router.refresh();
    },
    [notifyDeleted, router]
  );

  const visibleLogs = state.kind === "ready" ? state.logs.filter((l) => !deletedIds.has(l.id)) : [];
  const allDeleted = state.kind === "ready" && state.logs.length > 0 && visibleLogs.length === 0;
  const headerTitle = title ?? (visibleLogs[0]?.routine.name ?? "Log");

  return (
    <>
      <div className="logDrawerBackdrop" onClick={closeViewer} />
      <div className="logDrawerSheet">
        <div style={headerStyle}>
          <div style={headerTitleStack}>
            <span style={drawerTitleStyle}>{headerTitle}</span>
            {state.kind === "ready" && visibleLogs.length > 1 ? (
              <span style={subTitleStyle}>{visibleLogs.length} logs · this day</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={closeViewer}
            style={closeBtnStyle}
            aria-label="Close log view"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              width={16}
              height={16}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            Close
          </button>
        </div>

        <div style={bodyStyle}>
          {state.kind === "loading" && <LoadingSkeleton />}
          {state.kind === "error" && (
            <div style={errorBlock}>
              <div style={{ color: "rgba(255,140,140,0.95)", fontSize: 14, fontWeight: 700 }}>
                {state.message}
              </div>
              <button
                type="button"
                onClick={() => setRetryNonce((n) => n + 1)}
                style={retryBtnStyle}
              >
                Retry
              </button>
            </div>
          )}
          {state.kind === "ready" && state.logs.length === 0 && (
            <div style={emptyState}>No log found.</div>
          )}
          {state.kind === "ready" && allDeleted && (
            <div style={emptyState}>All logs deleted.</div>
          )}
          {state.kind === "ready" && visibleLogs.length > 0 && (
            <div style={{ display: "grid", gap: 16 }}>
              {visibleLogs.map((log, idx) => (
                <LogCard
                  key={log.id}
                  log={log}
                  index={idx}
                  total={visibleLogs.length}
                  onDelete={() => handleDelete(log)}
                  onEdit={() => {
                    // Hand off to the edit drawer — close the view shell so
                    // the edit shell takes its place, mirroring the user's
                    // "minimizable screen that replaces the current" model.
                    closeViewer();
                    openEditDrawer(log.id, { title: log.routine.name });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {flash ? (
          <div role="status" style={flashStyle}>
            {flash}
          </div>
        ) : null}
      </div>
    </>
  );
}

function LogCard({
  log,
  index,
  total,
  onDelete,
  onEdit,
}: {
  log: LogSummaryData;
  index: number;
  total: number;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div style={cardStyle}>
      <div style={cardHeader}>
        <div style={cardHeaderTextStack}>
          <span style={cardHeaderTitle}>
            {total > 1 ? `Log ${index + 1} of ${total}` : "Log"}
          </span>
          <span style={cardHeaderTime}>{formatAppDateTime(log.performedAt)}</span>
        </div>
        <div style={cardHeaderActions}>
          <button type="button" onClick={onEdit} style={editBtnStyle}>
            Edit
          </button>
          <button type="button" onClick={onDelete} style={deleteBtnStyle}>
            Delete
          </button>
        </div>
      </div>

      <div style={cardBody}>
        <RoutineLogSummary data={log} />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "grid", gap: 12, paddingTop: 4 }}>
      <div className="skeleton" style={{ height: 22, width: "55%" }} />
      <div className="skeleton" style={{ height: 80 }} />
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 80 }} />
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "0 16px",
  height: 56,
  borderBottom: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.03)",
  flexShrink: 0,
};

const headerTitleStack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  overflow: "hidden",
};

const drawerTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const subTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.62,
};

const closeBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 12px",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  color: "rgba(255,255,255,0.7)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 0,
  flexShrink: 0,
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 16,
  paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
};

const emptyState: React.CSSProperties = {
  padding: "40px 0",
  textAlign: "center",
  opacity: 0.65,
  fontSize: 14,
};

const errorBlock: React.CSSProperties = {
  padding: "32px 16px",
  textAlign: "center",
  display: "grid",
  gap: 14,
  justifyItems: "center",
};

const retryBtnStyle: React.CSSProperties = {
  minHeight: 40,
  padding: "8px 18px",
  border: "1px solid rgba(129,140,248,0.5)",
  borderRadius: 10,
  background: "rgba(129,140,248,0.12)",
  color: "rgb(199,210,254)",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 14,
  background: "rgba(255,255,255,0.02)",
  overflow: "hidden",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  borderBottom: "1px solid rgba(128,128,128,0.22)",
  background: "rgba(128,128,128,0.06)",
  flexWrap: "wrap",
};

const cardHeaderTextStack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const cardHeaderTitle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  opacity: 0.78,
};

const cardHeaderTime: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

const cardHeaderActions: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const cardBody: React.CSSProperties = {
  padding: 14,
  display: "grid",
  gap: 12,
};

const editBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid rgba(84,203,130,0.7)",
  borderRadius: 8,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  fontSize: 12,
  background: "rgba(84,203,130,0.16)",
};

const deleteBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid rgba(248,113,113,0.6)",
  borderRadius: 8,
  color: "rgb(252,165,165)",
  fontWeight: 800,
  fontSize: 12,
  background: "rgba(248,113,113,0.12)",
  cursor: "pointer",
};

const flashStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 18,
  left: "50%",
  transform: "translateX(-50%)",
  padding: "8px 16px",
  background: "rgba(20,20,24,0.92)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.2,
  boxShadow: "0 14px 32px rgba(0,0,0,0.4)",
};
