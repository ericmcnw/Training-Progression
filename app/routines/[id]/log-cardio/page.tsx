import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isCardioKind } from "@/lib/routines";
import LogRunForm from "./ui";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function LogCardioPage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const routineId = params?.id;

  if (!routineId) {
    return <div style={{ padding: 20 }}>Missing routine id.</div>;
  }

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
  });

  if (!routine) {
    return <div style={{ padding: 20 }}>Routine not found.</div>;
  }

  if (!isCardioKind(String(routine.kind))) {
    return <div style={{ padding: 20 }}>This routine is not a cardio routine.</div>;
  }

  const recentLogs = await prisma.routineLog.findMany({
    where: {
      routineId,
      distanceMi: { not: null },
      durationSec: { not: null },
    },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      performedAt: true,
      distanceMi: true,
      durationSec: true,
      notes: true,
    },
  });

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>{routine.name} - Log Cardio</h1>
          <div style={styles.sub}>{routine.category}</div>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>CARDIO DETAILS</div>
        <div style={{ padding: 14 }}>
          <LogRunForm routineId={routine.id} />
        </div>
      </div>

      <section style={{ marginTop: 16, border: border, borderRadius: 12, overflow: "hidden" }}>
        <div style={styles.panelHeader}>RECENT CARDIO LOGS</div>
        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {recentLogs.length === 0 && <div style={{ opacity: 0.75 }}>No cardio logs yet.</div>}
          {recentLogs.map((log) => (
            <div
              key={log.id}
              style={{
                border: "1px solid rgba(128,128,128,0.28)",
                borderRadius: 10,
                padding: 10,
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
                background: "rgba(128,128,128,0.06)",
              }}
            >
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 800 }}>{new Date(log.performedAt).toLocaleString()}</div>
                <div style={{ opacity: 0.8, marginTop: 2 }}>
                  {(log.distanceMi ?? 0).toFixed(2)} mi | {Math.floor((log.durationSec ?? 0) / 60)}m {(log.durationSec ?? 0) % 60}s
                </div>
                {log.notes ? <div style={{ opacity: 0.75, marginTop: 2 }}>{log.notes}</div> : null}
              </div>
              <Link
                href={`/routines/${routineId}/log-cardio/${log.id}`}
                style={{
                  padding: "8px 10px",
                  border: "1px solid rgba(128,128,128,0.7)",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: "inherit",
                  background: "rgba(128,128,128,0.12)",
                  fontWeight: 800,
                }}
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const border = "1px solid rgba(128,128,128,0.35)";
const bgBar = "rgba(128,128,128,0.14)";

const styles = {
  container: { maxWidth: 980, margin: "0 auto", padding: 20 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  h1: { fontSize: 26, fontWeight: 900 as const, margin: 0 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 13 },

  panel: { marginTop: 16, border, borderRadius: 12, overflow: "hidden" },
  panelHeader: { padding: "10px 14px", background: bgBar, borderBottom: border, fontWeight: 900 as const },
};
