import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isPeriodKind, resolvePeriod } from "@/lib/reports/period";
import ReportShell from "../ReportShell";
import WeekReport from "../WeekReport";
import PeriodPlaceholder from "../PeriodPlaceholder";

export const dynamic = "force-dynamic";

export default async function ReportPeriodPage({
  params,
  searchParams,
}: {
  params: Promise<{ period: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period: periodParam } = await params;
  if (!isPeriodKind(periodParam)) notFound();

  const sp = await searchParams;
  const raw = sp[periodParam];
  const anchor = typeof raw === "string" ? raw : undefined;
  const period = resolvePeriod(periodParam, anchor);

  // Earliest log → the shell disables "prev" before any data exists.
  const earliest = await prisma.routineLog.findFirst({
    orderBy: { performedAt: "asc" },
    select: { performedAt: true },
  });
  const earliestMs = earliest ? earliest.performedAt.getTime() : null;

  return (
    <ReportShell period={period} earliestMs={earliestMs}>
      {period.kind === "week" ? (
        <WeekReport period={period} />
      ) : (
        <PeriodPlaceholder period={period} />
      )}
    </ReportShell>
  );
}
