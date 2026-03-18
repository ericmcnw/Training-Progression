import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isSessionKind } from "@/lib/routines";
import type { Prisma } from "@/generated/prisma";
import { withSessionMetricConfig } from "@/lib/session-templates";
import SessionLogForm from "./SessionLogForm";

export const dynamic = "force-dynamic";

type Params = { id: string };

function preferredClimbingGrades(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).preferredClimbingGrades;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export default async function LogSessionPage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const routineId = params?.id;
  if (!routineId) return <div style={{ padding: 20 }}>Missing routine id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      id: true,
      name: true,
      category: true,
      kind: true,
      sessionDetails: {
        select: {
          templateConfig: true,
          template: {
            include: {
              metricDefinitions: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (!isSessionKind(routine.kind)) return <div style={{ padding: 20 }}>This routine is not a session routine.</div>;

  const recentLogs = await prisma.routineLog.findMany({
    where: { routineId },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      performedAt: true,
      durationSec: true,
      location: true,
      notes: true,
      sessionMetricValues: {
        orderBy: { metricDefinition: { sortOrder: "asc" } },
        select: {
          numberValue: true,
          textValue: true,
          booleanValue: true,
          metricDefinition: {
            select: {
              label: true,
              unit: true,
            },
          },
        },
      },
    },
  });
  const templateDefinitions = routine.sessionDetails?.template?.metricDefinitions.map(withSessionMetricConfig) ?? [];

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{routine.name} - Log Session</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{routine.category}</div>
        </div>
        <Link href="/routines" style={linkBtn}>
          Back
        </Link>
      </div>

      <section style={panel}>
        <div style={panelHeader}>SESSION DETAILS</div>
        <div style={{ padding: 14 }}>
          <SessionLogForm
            routineId={routineId}
            templateKey={routine.sessionDetails?.template?.key ?? null}
            templateName={routine.sessionDetails?.template?.name ?? null}
            definitions={templateDefinitions}
            preferredClimbingGrades={preferredClimbingGrades(routine.sessionDetails?.templateConfig)}
          />
        </div>
      </section>

      <section style={{ ...panel, marginTop: 16 }}>
        <div style={panelHeader}>RECENT SESSION LOGS</div>
        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {recentLogs.length === 0 && <div style={{ opacity: 0.75 }}>No session logs yet.</div>}
          {recentLogs.map((log) => (
            <div key={log.id} style={card}>
              <div style={{ fontWeight: 800 }}>{new Date(log.performedAt).toLocaleString()}</div>
              <div style={{ opacity: 0.8, marginTop: 2 }}>
                {log.durationSec ? `${Math.round(log.durationSec / 60)} min` : "No duration"}
                {log.location ? ` | ${log.location}` : ""}
              </div>
              {log.sessionMetricValues.length > 0 && (
                <div style={{ opacity: 0.75, marginTop: 2 }}>
                  {log.sessionMetricValues
                    .map((metric) => {
                      if (metric.textValue) return `${metric.metricDefinition.label}: ${metric.textValue}`;
                      if (metric.numberValue !== null && metric.numberValue !== undefined) {
                        return `${metric.metricDefinition.label}: ${metric.numberValue}${metric.metricDefinition.unit ? ` ${metric.metricDefinition.unit}` : ""}`;
                      }
                      if (metric.booleanValue !== null && metric.booleanValue !== undefined) {
                        return `${metric.metricDefinition.label}: ${metric.booleanValue ? "Yes" : "No"}`;
                      }
                      return null;
                    })
                    .filter(Boolean)
                    .join(" | ")}
                </div>
              )}
              {log.notes ? <div style={{ opacity: 0.75, marginTop: 2 }}>{log.notes}</div> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const panel: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 10,
  padding: 10,
  background: "rgba(128,128,128,0.06)",
  fontSize: 13,
};

const linkBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.12)",
};
