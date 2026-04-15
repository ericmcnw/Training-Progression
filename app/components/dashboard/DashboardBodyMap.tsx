import Link from "next/link";
import DashboardBodyMapClient from "./DashboardBodyMapClient";
import { getAllZonesWithState } from "@/lib/body-zones";

export default async function DashboardBodyMap() {
  const zones = await getAllZonesWithState();
  const workedThisWeek = zones.filter((zone) => (zone.activityCount ?? 0) > 0).length;
  const workEntriesThisWeek = zones.reduce((sum, zone) => sum + (zone.activityCount ?? 0), 0);
  const recovering = zones.filter((zone) => zone.freshness === "RECOVERING").length;
  const injured = zones.filter((zone) => zone.freshness === "INJURED").length;

  return (
    <section style={panel}>
      <div style={header}>
        <div>
          <div style={title}>BODY MAP</div>
          <div style={subtitle}>{workEntriesThisWeek} work entries this week</div>
        </div>
        <Link href="/body/log-pain" style={logPainLink}>
          Log pain
        </Link>
      </div>
      <div style={body}>
        <DashboardBodyMapClient zones={zones} />
        <div style={summary}>
          {workedThisWeek} zones worked this week · {recovering} recovering · {injured} injured
        </div>
      </div>
    </section>
  );
}

const panel: React.CSSProperties = {
  borderRadius: 20,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(20,29,46,0.9), rgba(13,19,31,0.92))",
  boxShadow: "0 12px 34px rgba(0,0,0,0.16)",
};

const header: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const title: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
};

const subtitle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  opacity: 0.68,
  letterSpacing: 0,
};

const body: React.CSSProperties = {
  padding: 14,
  display: "grid",
  gap: 12,
};

const logPainLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid rgba(248,113,113,0.32)",
  background: "rgba(248,113,113,0.10)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const summary: React.CSSProperties = {
  borderRadius: 12,
  padding: "9px 10px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(255,255,255,0.76)",
};
