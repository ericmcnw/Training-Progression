import Link from "next/link";
import { getAllZonesWithState } from "@/lib/body-zones";
import BodyPageClient from "./BodyPageClient";

export const dynamic = "force-dynamic";

export default async function BodyPage() {
  const zones = await getAllZonesWithState();

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, opacity: 0.55, textTransform: "uppercase" }}>Body</div>
        <h1 style={{ margin: "5px 0 0", fontSize: 32, lineHeight: 1.08 }}>Body</h1>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/body/log-pain" style={linkStyle}>Log pain</Link>
        <Link href="/injuries" style={linkStyle}>Injuries</Link>
      </div>
      <BodyPageClient zones={zones} />
    </main>
  );
}

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
