import Link from "next/link";
import { getGearLists, type GearListSummary } from "@/lib/gear-lists";
import { getActivityEntry } from "@/lib/activity-families";
import NewListButton from "./NewListButton";

export const dynamic = "force-dynamic";

const GRAMS_PER_LB = 453.59237;
const GRAMS_PER_OZ = 28.349523125;

function fmtWeight(grams: number): string {
  if (grams <= 0) return "—";
  if (grams < GRAMS_PER_LB) return `${Math.round(grams / GRAMS_PER_OZ)} oz`;
  return `${(grams / GRAMS_PER_LB).toFixed(1)} lb`;
}

export default async function GearListsPage() {
  const lists = await getGearLists();

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <div style={eyebrow}>Plan · Gear</div>
          <h1 style={title}>Gear lists</h1>
        </div>
        <NewListButton />
      </header>

      <p style={intro}>
        A list is a reusable kit — pack against it before a trip, or apply it to a log to fill in what you brought. Applying
        copies items into the log, so trimming a trip never changes the list.
      </p>

      {lists.length === 0 ? (
        <div style={empty}>No lists yet. Create one — “Backpacking kit”, “Winter run kit” — and add your gear.</div>
      ) : (
        <div style={grid}>
          {lists.map((l) => (
            <ListCard key={l.id} list={l} />
          ))}
        </div>
      )}

      <Link href="/gear" style={backLink}>
        ← Gear
      </Link>
    </div>
  );
}

function ListCard({ list }: { list: GearListSummary }) {
  const activity = list.activitySlug ? getActivityEntry(list.activitySlug) : null;
  return (
    <Link href={`/gear/lists/${list.id}`} style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span aria-hidden style={cardIcon}>
          {activity?.icon ?? "🎒"}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={cardName}>{list.name}</div>
          <div style={cardSub}>
            {activity ? activity.label : "Any activity"} · {list.itemCount} item{list.itemCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={cardWeight}>{fmtWeight(list.checkedGrams)}</div>
        <div style={cardSub}>
          {list.checkedCount}/{list.itemCount} packed
        </div>
      </div>
    </Link>
  );
}

const page: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "18px 14px 60px", display: "grid", gap: 16 };
const header: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.5 };
const title: React.CSSProperties = { margin: "2px 0 0", fontSize: 26, fontWeight: 900, letterSpacing: -0.4 };
const intro: React.CSSProperties = { margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.5 };
const empty: React.CSSProperties = {
  padding: "14px 12px",
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.02)",
  fontSize: 13,
  opacity: 0.75,
  lineHeight: 1.5,
};
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 };
const card: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(128,128,128,0.28)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
  textDecoration: "none",
  color: "inherit",
};
const cardIcon: React.CSSProperties = { fontSize: 24, flexShrink: 0, width: 32, textAlign: "center" };
const cardName: React.CSSProperties = { fontWeight: 900, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const cardSub: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, opacity: 0.58, whiteSpace: "nowrap" };
const cardWeight: React.CSSProperties = { fontWeight: 900, fontSize: 16, letterSpacing: -0.3 };
const backLink: React.CSSProperties = { justifySelf: "start", fontSize: 13, fontWeight: 800, color: "rgba(147,197,253,0.9)", textDecoration: "none", padding: "6px 2px" };
