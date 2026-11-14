import { basePrisma } from "@/lib/prisma-base";
import { getAppSession } from "@/lib/auth";
import { addDaysYmd, toAppYmd, todayAppYmd } from "@/lib/dates";
import { normalizeRoutineKind } from "@/lib/routines";
import { mondayOfYmd } from "@/lib/program-plan";

export type HomeClient = {
  key: string;
  name: string;
  weekLogged: number;
  weekScheduled: number;
  next: { ymd: string; label: string } | null;
  lastLogYmd: string | null;
  programs: Array<{ name: string; phase: string | null }>;
  setupPending: boolean;
};

function isTraining(kind: string) {
  return normalizeRoutineKind(kind) !== "COMPLETION";
}

/** Clients of the signed-in admin, read across profiles; empty while viewing as someone. */
export async function getHomeClients(): Promise<HomeClient[]> {
  const session = await getAppSession();
  if (!session.isAdmin || session.ownProfileKey) return [];

  const profiles = await basePrisma.appProfile.findMany({
    where: { managedByKey: session.profileKey },
    orderBy: { createdAt: "asc" },
    select: { key: true, displayName: true, email: true, onboardedAt: true },
  });
  if (profiles.length === 0) return [];

  const keys = profiles.map((p) => p.key);
  const today = todayAppYmd();
  const monday = mondayOfYmd(today);
  const sunday = addDaysYmd(monday, 6);
  const horizon = addDaysYmd(today, 14);

  const [weekLogs, lastLogs, schedule, programs] = await Promise.all([
    basePrisma.routineLog.findMany({
      where: { profileKey: { in: keys }, performedAt: { gte: new Date(`${addDaysYmd(monday, -1)}T00:00:00.000Z`) } },
      select: { profileKey: true, performedAt: true, routine: { select: { kind: true } } },
    }),
    basePrisma.routineLog.groupBy({ by: ["profileKey"], where: { profileKey: { in: keys } }, _max: { performedAt: true } }),
    basePrisma.scheduleManualEntry.findMany({
      where: {
        profileKey: { in: keys },
        scheduledDate: {
          gte: new Date(`${addDaysYmd(monday, -1)}T00:00:00.000Z`),
          lte: new Date(`${addDaysYmd(horizon > sunday ? horizon : sunday, 1)}T23:59:59.999Z`),
        },
      },
      orderBy: [{ scheduledDate: "asc" }, { sortOrder: "asc" }],
      select: {
        profileKey: true,
        scheduledDate: true,
        routine: { select: { name: true, kind: true } },
        activityType: { select: { name: true } },
      },
    }),
    basePrisma.focus.findMany({
      where: { profileKey: { in: keys }, status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
      select: { profileKey: true, name: true, stages: { where: { status: "ACTIVE" }, take: 1, select: { name: true } } },
    }),
  ]);

  const lastByKey = new Map(lastLogs.map((row) => [row.profileKey, row._max.performedAt]));
  return profiles.map((profile) => {
    const logged = weekLogs.filter((log) => {
      if (log.profileKey !== profile.key || !isTraining(log.routine.kind)) return false;
      const ymd = toAppYmd(log.performedAt);
      return ymd >= monday && ymd <= sunday;
    }).length;
    const entries = schedule
      .filter((entry) => entry.profileKey === profile.key && isTraining(entry.routine.kind))
      .map((entry) => ({ ymd: toAppYmd(entry.scheduledDate), label: entry.activityType?.name ?? entry.routine.name }));
    const next = entries.find((entry) => entry.ymd >= today && entry.ymd <= horizon) ?? null;
    const last = lastByKey.get(profile.key);
    return {
      key: profile.key,
      name: profile.displayName ?? profile.email ?? profile.key,
      weekLogged: logged,
      weekScheduled: entries.filter((entry) => entry.ymd >= monday && entry.ymd <= sunday).length,
      next,
      lastLogYmd: last ? toAppYmd(last) : null,
      programs: programs
        .filter((program) => program.profileKey === profile.key)
        .map((program) => ({ name: program.name, phase: program.stages[0]?.name ?? null })),
      setupPending: !profile.onboardedAt,
    };
  });
}
