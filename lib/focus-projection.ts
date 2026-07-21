// Roadmap projection — the sliding-timeline engine. Pure + isomorphic (no DB,
// no clock of its own; `todayYmd` is passed in) so it's trivially testable and
// safe on either side of the server/client boundary.
//
// It projects only the REMAINING (ACTIVE) milestones forward from today. As
// milestones get marked met they drop out of the projection, so the remaining
// ones re-anchor to today automatically — that's the auto-slide. Milestones
// chain within their track (each starts when the prior ends) and can wait on a
// milestone in another track via dependsOnMilestoneId (start = the later of the
// two). A milestone with no estimate falls back to DEFAULT_DURATION_DAYS.

import { addDaysYmd, diffYmdDays } from "@/lib/dates";

export const DEFAULT_DURATION_DAYS = 14;

export type ProjectionInputMilestone = {
  id: string;
  trackKey: string;
  sortOrder: number;
  status: "ACTIVE" | "ACHIEVED" | "SKIPPED";
  estDurationDays: number | null;
  dependsOnMilestoneId: string | null;
};

export type MilestoneProjection = { startYmd: string; endYmd: string };

export type RoadmapProjection = {
  // id → projected window (only for ACTIVE milestones).
  byMilestone: Record<string, MilestoneProjection>;
  // Latest projected end across all tracks, or null if nothing is active.
  projectedCompletionYmd: string | null;
  // vs the focus target (when one is set).
  target: { ymd: string; kind: "SOFT" | "HARD" } | null;
  // + = projected past target (behind), − = ahead, 0 = on the day.
  driftDays: number | null;
  status: "no_target" | "done" | "ahead" | "on_track" | "behind";
};

function maxYmd(a: string, b: string): string {
  // ISO YMD strings sort lexically, so string compare is date compare.
  return a >= b ? a : b;
}

export function projectRoadmap(
  milestones: ProjectionInputMilestone[],
  todayYmd: string,
  target: { ymd: string; kind: "SOFT" | "HARD" } | null
): RoadmapProjection {
  const active = milestones.filter((m) => m.status === "ACTIVE");

  if (active.length === 0) {
    // Everything done/skipped → the roadmap is complete.
    const anyDone = milestones.some((m) => m.status === "ACHIEVED");
    return {
      byMilestone: {},
      projectedCompletionYmd: null,
      target,
      driftDays: null,
      status: anyDone ? "done" : "no_target",
    };
  }

  const byId = new Map(active.map((m) => [m.id, m]));

  // Previous ACTIVE milestone within each track (by sortOrder).
  const tracks = new Map<string, ProjectionInputMilestone[]>();
  for (const m of active) {
    const list = tracks.get(m.trackKey) ?? [];
    list.push(m);
    tracks.set(m.trackKey, list);
  }
  const prevInTrack = new Map<string, string | null>();
  for (const list of tracks.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
    list.forEach((m, i) => prevInTrack.set(m.id, i > 0 ? list[i - 1].id : null));
  }

  const startMemo = new Map<string, string>();
  const endMemo = new Map<string, string>();
  const visiting = new Set<string>();

  function projEnd(id: string): string {
    const cached = endMemo.get(id);
    if (cached) return cached;
    const m = byId.get(id)!;
    const dur = m.estDurationDays ?? DEFAULT_DURATION_DAYS;
    const end = addDaysYmd(projStart(id), Math.max(1, dur));
    endMemo.set(id, end);
    return end;
  }

  function projStart(id: string): string {
    const cached = startMemo.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return todayYmd; // cycle guard — degrade gracefully
    visiting.add(id);

    const m = byId.get(id)!;
    let start = todayYmd;
    const prev = prevInTrack.get(id);
    if (prev) start = maxYmd(start, projEnd(prev));
    if (m.dependsOnMilestoneId && byId.has(m.dependsOnMilestoneId)) {
      start = maxYmd(start, projEnd(m.dependsOnMilestoneId));
    }

    visiting.delete(id);
    startMemo.set(id, start);
    return start;
  }

  const byMilestone: Record<string, MilestoneProjection> = {};
  let completion = todayYmd;
  for (const m of active) {
    const startYmd = projStart(m.id);
    const endYmd = projEnd(m.id);
    byMilestone[m.id] = { startYmd, endYmd };
    completion = maxYmd(completion, endYmd);
  }

  let driftDays: number | null = null;
  let status: RoadmapProjection["status"] = "no_target";
  if (target) {
    driftDays = diffYmdDays(completion, target.ymd); // + = completion after target
    status = driftDays > 3 ? "behind" : driftDays < -3 ? "ahead" : "on_track";
  }

  return {
    byMilestone,
    projectedCompletionYmd: completion,
    target,
    driftDays,
    status,
  };
}
