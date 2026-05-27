import Link from "next/link";
import RoutineLogSummary from "@/app/components/RoutineLogSummary";
import { formatAppDateTime } from "@/lib/dates";
import { getLogSummaryData } from "@/lib/log-summary";

export const dynamic = "force-dynamic";

type Params = { id: string; logId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function getEditHref(routineId: string, logId: string, returnTo: string) {
  const encoded = encodeURIComponent(returnTo);
  return `/routines/${routineId}/logs/${logId}/edit?returnTo=${encoded}`;
}

export default async function RoutineLogDetailPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const routineId = params?.id;
  const logId = params?.logId;
  const returnToRaw = String(getParam(searchParams, "returnTo") || "").trim();
  const returnTo = returnToRaw.startsWith("/") ? returnToRaw : "/schedule";

  if (!routineId || !logId) return <div style={{ padding: 20 }}>Missing routine/log id.</div>;

  const data = await getLogSummaryData(logId);
  if (!data || data.routineId !== routineId) {
    return <div style={{ padding: 20 }}>Log not found for this routine.</div>;
  }

  const editHref = getEditHref(routineId, logId, returnTo);

  return (
    <div style={container}>
      <div style={topRow}>
        <div>
          <h1 style={title}>{data.routine.name} Log</h1>
          <div style={subText}>{formatAppDateTime(data.performedAt)}</div>
        </div>
        <div style={actionRow}>
          <Link href={returnTo} style={linkBtn}>
            Back
          </Link>
          <Link href={editHref} style={editBtn}>
            Edit Log
          </Link>
        </div>
      </div>

      <RoutineLogSummary data={data} />
    </div>
  );
}

const container: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 16,
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  flexWrap: "wrap",
};

const title: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  margin: 0,
};

const subText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  opacity: 0.78,
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
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

const editBtn: React.CSSProperties = {
  ...linkBtn,
  border: "1px solid rgba(84,203,130,0.8)",
  background: "rgba(84,203,130,0.16)",
};
