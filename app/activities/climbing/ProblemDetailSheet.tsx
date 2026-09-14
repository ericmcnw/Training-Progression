"use client";

// Tapping a tick-list row opens this instead of navigating to the location
// page — the question a starred problem raises is "where am I on it", and
// that answer is its session history, beta and photos, not the whole crag.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SportLogModal from "@/app/routines/SportLogModal";
import { formatAppDate } from "@/lib/dates";
import MediaGallery from "@/app/components/climbing/MediaGallery";
import MediaUploader from "@/app/components/climbing/MediaUploader";
import { ProblemSessionList } from "./ProblemSessionHistory";
import { loadClimbProblemDetail, type ClimbProblemDetail } from "./locations/[id]/actions";

export default function ProblemDetailSheet({
  problemId,
  name,
  grade,
  locationId,
  locationName,
  onClose,
}: {
  problemId: string;
  name: string;
  grade: string;
  locationId: string | null;
  locationName: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ClimbProblemDetail | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    return loadClimbProblemDetail(problemId)
      .then((next) => {
        if (next) setDetail(next);
      })
      .catch(() => setFailed(true));
  }, [problemId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sessionCount = detail?.sessions.length ?? 0;
  const summary = detail
    ? [
        `${detail.totalTries} ${detail.totalTries === 1 ? "try" : "tries"}`,
        `${sessionCount} session${sessionCount === 1 ? "" : "s"}`,
        detail.sentAt
          ? `sent ${formatAppDate(detail.sentAt, { month: "short", day: "numeric" })}`
          : "not sent",
      ].join(" · ")
    : null;

  return (
    <SportLogModal title={name} onClose={onClose}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={gradePillStyle}>{grade}</span>
            <span style={{ fontSize: 15, fontWeight: 900, minWidth: 0 }}>{name}</span>
          </div>
          <span style={{ fontSize: 12, opacity: 0.65, fontWeight: 700 }}>
            {locationName ?? "No location"}
            {summary ? ` · ${summary}` : ""}
          </span>
        </div>

        {failed ? <div style={hintStyle}>Could not load this problem.</div> : null}

        {detail?.notes ? (
          <div style={blockStyle}>
            <span style={labelStyle}>Beta</span>
            <span style={{ fontSize: 13, lineHeight: 1.45 }}>{detail.notes}</span>
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 6 }}>
          <span style={labelStyle}>Sessions</span>
          {detail ? (
            <ProblemSessionList sessions={detail.sessions} />
          ) : (
            <div style={hintStyle}>Loading sessions…</div>
          )}
          <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 600 }}>
            Tap a date to open that session. Edit tries in place.
          </span>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <span style={labelStyle}>
            Photos &amp; links
            {detail && detail.media.length > 0 ? ` (${detail.media.length})` : ""}
          </span>
          <MediaUploader target={{ kind: "problem", problemId }} onUploaded={() => void reload()} />
          <MediaGallery
            items={detail?.media ?? []}
            emptyHint="No photos for this problem yet — add a topo, beta shot, or send video above."
          />
        </div>

        {locationId ? (
          <Link href={`/activities/climbing/locations/${locationId}`} style={linkBtnStyle}>
            Open {locationName ?? "location"} →
          </Link>
        ) : null}
      </div>
    </SportLogModal>
  );
}

const gradePillStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  padding: "3px 9px",
  borderRadius: 8,
  background: "rgba(253,186,116,0.14)",
  color: "rgba(253,186,116,0.95)",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.55,
};

const blockStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const hintStyle: React.CSSProperties = { fontSize: 12, opacity: 0.6 };

const linkBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};
