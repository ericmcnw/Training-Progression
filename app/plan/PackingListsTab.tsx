import Link from "next/link";
import { getGearLists } from "@/lib/gear-lists";
import { getActivityEntry } from "@/lib/activity-families";

const GRAMS_PER_LB = 453.59237;
const GRAMS_PER_OZ = 28.349523125;

function fmtWeight(grams: number): string {
  if (grams <= 0) return "—";
  if (grams < GRAMS_PER_LB) return `${Math.round(grams / GRAMS_PER_OZ)} oz`;
  return `${(grams / GRAMS_PER_LB).toFixed(1)} lb`;
}

export default async function PackingListsTab() {
  const lists = await getGearLists();

  if (lists.length === 0) {
    return (
      <Link href="/gear/lists" style={empty}>
        Build a packing list or loadout — tick off your kit before a trip, then apply it to your log. Start one →
      </Link>
    );
  }

  return (
    <div style={grid}>
      {lists.map((l) => {
        const activity = l.activitySlug ? getActivityEntry(l.activitySlug) : null;
        return (
          <Link key={l.id} href={`/gear/lists/${l.id}`} style={card}>
            <span aria-hidden style={icon}>
              {activity?.icon ?? "🎒"}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={name}>{l.name}</div>
              <div style={sub}>
                {l.checkedCount}/{l.itemCount} packed · {fmtWeight(l.checkedGrams)}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 };
const card: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)",
  textDecoration: "none",
  color: "inherit",
};
const icon: React.CSSProperties = { fontSize: 22, flexShrink: 0, width: 28, textAlign: "center" };
const name: React.CSSProperties = { fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const sub: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, opacity: 0.58 };
const empty: React.CSSProperties = {
  display: "block",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.02)",
  fontSize: 13,
  opacity: 0.8,
  lineHeight: 1.5,
  textDecoration: "none",
  color: "inherit",
};
