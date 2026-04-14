import Link from "next/link";
import InjuryCard from "@/app/components/injuries/InjuryCard";
import { getInjuries } from "./actions";

export const dynamic = "force-dynamic";

const groups = [
  { status: "ACTIVE", title: "Active" },
  { status: "FLARED", title: "Flared" },
  { status: "RECOVERING", title: "Recovering" },
  { status: "RESOLVED", title: "Resolved" },
] as const;

export default async function InjuriesPage() {
  const injuries = await getInjuries();

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={eyebrow}>Body</div>
          <h1 style={h1}>Injuries</h1>
        </div>
        <Link href="/injuries/new" style={linkStyle}>
          New injury
        </Link>
      </div>
      {groups.map((group) => {
        const rows = injuries.filter((injury) => injury.status === group.status);
        if (rows.length === 0 && group.status !== "RESOLVED") return null;
        const content = (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.length === 0 ? <div style={empty}>No {group.title.toLowerCase()} injuries.</div> : rows.map((injury) => <InjuryCard key={injury.id} injury={injury} />)}
          </div>
        );
        return group.status === "RESOLVED" ? (
          <details key={group.status} style={panel}>
            <summary style={summary}>{group.title}</summary>
            <div style={{ padding: 14 }}>{content}</div>
          </details>
        ) : (
          <section key={group.status} style={panel}>
            <div style={header}>{group.title}</div>
            <div style={{ padding: 14 }}>{content}</div>
          </section>
        );
      })}
    </main>
  );
}

const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 1.2, opacity: 0.55, textTransform: "uppercase" };
const h1: React.CSSProperties = { margin: "5px 0 0", fontSize: 32, lineHeight: 1.08 };
const panel: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden", background: "rgba(255,255,255,0.04)" };
const header: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 900, fontSize: 12, letterSpacing: 1 };
const summary: React.CSSProperties = { ...header, cursor: "pointer" };
const empty: React.CSSProperties = { color: "rgba(255,255,255,0.64)", fontSize: 13 };
const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 38,
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 8,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};
