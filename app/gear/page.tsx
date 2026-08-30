import Link from "next/link";
import { getAllGear } from "@/lib/gear";
import { getGearUsage, type GearUsage } from "@/lib/gear-usage";
import { getGearLists, type GearListSummary } from "@/lib/gear-lists";
import { gearTypeMeta } from "@/lib/gear-types";
import { getActivityEntry } from "@/lib/activity-families";

export const dynamic = "force-dynamic";

const GRAMS_PER_LB = 453.59237;
const GRAMS_PER_OZ = 28.349523125;

function fmtListWeight(grams: number): string {
  if (grams <= 0) return "—";
  if (grams < GRAMS_PER_LB) return `${Math.round(grams / GRAMS_PER_OZ)} oz`;
  return `${(grams / GRAMS_PER_LB).toFixed(1)} lb`;
}

function fmtUsage(u: GearUsage | undefined): string {
  if (!u) return "—";
  const n = u.value;
  if (u.unit === "miles") return `${n.toFixed(n >= 100 ? 0 : 1)} mi`;
  if (u.unit === "nights") return `${n} night${n === 1 ? "" : "s"}`;
  if (u.unit === "days") return `${n} day${n === 1 ? "" : "s"}`;
  return `${n} session${n === 1 ? "" : "s"}`;
}

function fmtDate(ymd: string | null): string | null {
  if (!ymd) return null;
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function groupLabel(activitySlug: string | null): string {
  if (!activitySlug) return "Everywhere";
  return getActivityEntry(activitySlug)?.label ?? activitySlug;
}

export default async function GearPage() {
  const [gear, lists] = await Promise.all([getAllGear(), getGearLists()]);
  const usage = await getGearUsage(gear.map((g) => g.id));

  const active = gear.filter((g) => !g.retiredAt);
  const retired = gear.filter((g) => g.retiredAt);

  // Group active gear: universal ("Everywhere") first, then per-activity.
  const groups = new Map<string, typeof active>();
  for (const g of active) {
    const key = g.activitySlug ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));

  return (
    <div style={page}>
      <header style={header}>
        <h1 style={title}>Gear</h1>
        <span style={countPill}>{active.length} item{active.length === 1 ? "" : "s"}</span>
      </header>

      {gear.length === 0 ? (
        <div style={empty}>
          No gear yet. Pick or add gear when you log a run, sport, or backpacking trip — it lands here with its usage.
        </div>
      ) : null}

      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div style={groupHeading}>Your lists</div>
          <Link href="/gear/lists" style={manageLink}>
            {lists.length > 0 ? "Manage →" : "New list →"}
          </Link>
        </div>
        {lists.length === 0 ? (
          <Link href="/gear/lists" style={listEmpty}>
            Build a packing list or loadout — pack against it before a trip, apply it to a log to fill in your gear.
          </Link>
        ) : (
          <div style={cardGrid}>
            {lists.map((l) => (
              <ListCard key={l.id} list={l} />
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "grid", gap: 18 }}>
        {orderedKeys.map((key) => (
          <section key={key || "everywhere"}>
            <div style={groupHeading}>{groupLabel(key || null)}</div>
            <div style={cardGrid}>
              {groups.get(key)!.map((g) => (
                <GearCard key={g.id} gear={g} usage={usage.get(g.id)} />
              ))}
            </div>
          </section>
        ))}

        {retired.length > 0 ? (
          <section>
            <div style={groupHeading}>Retired</div>
            <div style={cardGrid}>
              {retired.map((g) => (
                <GearCard key={g.id} gear={g} usage={usage.get(g.id)} retired />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <Link href="/activities" style={backLink}>
        ← Activities
      </Link>
    </div>
  );
}

function GearCard({
  gear,
  usage,
  retired,
}: {
  gear: { id: string; type: string; name: string };
  usage: GearUsage | undefined;
  retired?: boolean;
}) {
  const meta = gearTypeMeta(gear.type);
  const last = fmtDate(usage?.lastUsed ?? null);
  const sessions = usage?.sessions ?? 0;
  return (
    <Link href={`/gear/${gear.id}`} style={{ ...card, opacity: retired ? 0.55 : 1, textDecoration: "none", color: "inherit" }}>
      <span aria-hidden style={cardIcon}>{meta.icon}</span>
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <div style={cardName}>{gear.name}</div>
        <div style={cardSub}>{meta.label}{retired ? " · retired" : ""}</div>
      </div>
      <div style={cardUsage}>
        <div style={cardUsageValue}>{fmtUsage(usage)}</div>
        <div style={cardUsageSub}>
          {sessions} use{sessions === 1 ? "" : "s"}
          {last ? ` · ${last}` : ""}
        </div>
      </div>
    </Link>
  );
}

function ListCard({ list }: { list: GearListSummary }) {
  const activity = list.activitySlug ? getActivityEntry(list.activitySlug) : null;
  return (
    <Link href={`/gear/lists/${list.id}`} style={{ ...card, textDecoration: "none", color: "inherit" }}>
      <span aria-hidden style={cardIcon}>{activity?.icon ?? "🎒"}</span>
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <div style={cardName}>{list.name}</div>
        <div style={cardSub}>
          {activity ? activity.label : "Any activity"} · {list.itemCount} item{list.itemCount === 1 ? "" : "s"}
        </div>
      </div>
      <div style={cardUsage}>
        <div style={cardUsageValue}>{fmtListWeight(list.checkedGrams)}</div>
        <div style={cardUsageSub}>
          {list.checkedCount}/{list.itemCount} packed
        </div>
      </div>
    </Link>
  );
}

const manageLink: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: "rgba(147,197,253,0.9)", textDecoration: "none" };
const listEmpty: React.CSSProperties = {
  display: "block",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px dashed rgba(132,204,120,0.35)",
  background: "rgba(132,204,120,0.05)",
  fontSize: 12.5,
  opacity: 0.85,
  lineHeight: 1.5,
  textDecoration: "none",
  color: "inherit",
};
const page: React.CSSProperties = { maxWidth: "var(--app-width-content)", margin: "0 auto", padding: "18px 14px 60px", display: "grid", gap: 16 };
const header: React.CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 };
const title: React.CSSProperties = { margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.4 };
const countPill: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(132,204,120,0.32)",
  background: "rgba(132,204,120,0.10)",
  color: "rgba(170,224,150,0.95)",
};
const empty: React.CSSProperties = {
  padding: "14px 12px",
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.02)",
  fontSize: 13,
  opacity: 0.75,
  lineHeight: 1.5,
};
const groupHeading: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
  marginBottom: 8,
};
const cardGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 };
const card: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(128,128,128,0.28)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
};
const cardIcon: React.CSSProperties = { fontSize: 26, flexShrink: 0, width: 34, textAlign: "center" };
const cardName: React.CSSProperties = { fontWeight: 900, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const cardSub: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, opacity: 0.6 };
const cardUsage: React.CSSProperties = { marginLeft: "auto", textAlign: "right", flexShrink: 0 };
const cardUsageValue: React.CSSProperties = { fontWeight: 900, fontSize: 16, letterSpacing: -0.3 };
const cardUsageSub: React.CSSProperties = { fontSize: 11, fontWeight: 700, opacity: 0.55, whiteSpace: "nowrap" };
const backLink: React.CSSProperties = {
  justifySelf: "start",
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(147,197,253,0.9)",
  textDecoration: "none",
  padding: "6px 2px",
};
