// Read models for the /progressions surfaces. A progression's rungs are
// ProgressionMilestone rows owned via ownerKind = PROGRESSION.
//
// "Current" is derived, never stored: the first ACTIVE rung by sortOrder.
// Same rule the Focus roadmap uses, so a ladder reads identically wherever
// it appears.

import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import type { ProgressionStatus, MilestoneStatus } from "@/generated/prisma";

export type RungView = {
  id: string;
  label: string;
  modifier: string | null;
  targetText: string | null;
  status: MilestoneStatus;
  sortOrder: number;
};

export type ProgressionListItem = {
  id: string;
  name: string;
  status: ProgressionStatus;
  total: number;
  done: number;
  // The rung you're on now — null once every rung is done or skipped.
  current: { label: string; modifier: string | null; targetText: string | null } | null;
};

export type ProgressionDetail = {
  id: string;
  name: string;
  status: ProgressionStatus;
  notes: string | null;
  scopeRef: string | null;
  createdYmd: string;
  rungs: RungView[];
  total: number;
  done: number;
  currentId: string | null;
};

function summarize(rungs: RungView[]) {
  const done = rungs.filter((r) => r.status === "ACHIEVED").length;
  const current = rungs.find((r) => r.status === "ACTIVE") ?? null;
  return { done, current };
}

export async function getProgressions(): Promise<ProgressionListItem[]> {
  const session = await getAppSession();
  const rows = await prisma.progression.findMany({
    where: { profileKey: session.profileKey, status: { not: "ARCHIVED" } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, status: true },
  });
  if (rows.length === 0) return [];

  const rungs = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "PROGRESSION", ownerId: { in: rows.map((r) => r.id) } },
    orderBy: { sortOrder: "asc" },
    select: {
      ownerId: true,
      label: true,
      modifier: true,
      targetText: true,
      status: true,
    },
  });

  const byOwner = new Map<string, typeof rungs>();
  for (const r of rungs) {
    const list = byOwner.get(r.ownerId);
    if (list) list.push(r);
    else byOwner.set(r.ownerId, [r]);
  }

  return rows.map((row) => {
    const own = byOwner.get(row.id) ?? [];
    const done = own.filter((r) => r.status === "ACHIEVED").length;
    const current = own.find((r) => r.status === "ACTIVE") ?? null;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      total: own.length,
      done,
      current: current
        ? { label: current.label, modifier: current.modifier, targetText: current.targetText }
        : null,
    };
  });
}

export async function getProgressionDetail(id: string): Promise<ProgressionDetail | null> {
  const session = await getAppSession();
  const row = await prisma.progression.findFirst({
    where: { id, profileKey: session.profileKey },
    select: {
      id: true,
      name: true,
      status: true,
      notes: true,
      scopeRef: true,
      createdAt: true,
    },
  });
  if (!row) return null;

  const rungs = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "PROGRESSION", ownerId: id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      label: true,
      modifier: true,
      targetText: true,
      status: true,
      sortOrder: true,
    },
  });

  const { done, current } = summarize(rungs);
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    notes: row.notes,
    scopeRef: row.scopeRef,
    createdYmd: row.createdAt.toISOString().slice(0, 10),
    rungs,
    total: rungs.length,
    done,
    currentId: current?.id ?? null,
  };
}
