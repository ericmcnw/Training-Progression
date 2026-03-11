import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isGuidedKind } from "@/lib/routines";
import GuidedLogForm from "./GuidedLogForm";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function LogGuidedPage(props: { params: Promise<Params> | Params }) {
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
      guidedSteps: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, durationSec: true, restSec: true, sortOrder: true } },
    },
  });
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (!isGuidedKind(routine.kind)) return <div style={{ padding: 20 }}>This routine is not a guided routine.</div>;

  const recentLogs = await prisma.routineLog.findMany({
    where: { routineId },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: { id: true, performedAt: true, durationSec: true, notes: true, guidedSteps: { select: { id: true } } },
  });

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{routine.name} - Log Guided Routine</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{routine.category}</div>
        </div>
        <Link href="/routines" style={linkBtn}>
          Back
        </Link>
      </div>

      <section style={panel}>
        <div style={panelHeader}>GUIDED DETAILS</div>
        <div style={{ padding: 14 }}>
          <GuidedLogForm routineId={routineId} steps={routine.guidedSteps} />
        </div>
      </section>

      <section style={{ ...panel, marginTop: 16 }}>
        <div style={panelHeader}>RECENT GUIDED LOGS</div>
        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {recentLogs.length === 0 && <div style={{ opacity: 0.75 }}>No guided logs yet.</div>}
          {recentLogs.map((log) => (
            <div key={log.id} style={card}>
              <div style={{ fontWeight: 800 }}>{new Date(log.performedAt).toLocaleString()}</div>
              <div style={{ opacity: 0.8, marginTop: 2 }}>
                {log.durationSec ? `${Math.round(log.durationSec / 60)} min` : "No duration"} | {log.guidedSteps.length} saved steps
              </div>
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
