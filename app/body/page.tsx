import Link from "next/link";
import { getAllZonesWithState } from "@/lib/body-zones";
import BodyPageClient from "./BodyPageClient";
import { getCoverageOverviewModel, type CoverageLens, type CoverageRange } from "@/app/progress/coverage";
import CoverageGroupedBarChart from "@/app/progress/CoverageGroupedBarChart";
import PageShell from "@/app/components/PageShell";
import { cardSurface, cardTitle, COLOR, RADIUS } from "@/lib/design-tokens";
import { getInjuries } from "@/app/injuries/actions";
import type { InjuryStatus } from "@/generated/prisma";
import type { ZoneFreshness, ZoneState } from "@/app/components/body-map/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const VALID_RANGES: CoverageRange[] = ["week", "2w", "4w", "12w", "ytd"];

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeBodyLens(value: string | undefined): Exclude<CoverageLens, "sports"> {
  return value === "patterns" ? "patterns" : "muscles";
}

function normalizeBodyRange(value: string | undefined): CoverageRange {
  return VALID_RANGES.includes(value as CoverageRange) ? (value as CoverageRange) : "4w";
}

export default async function BodyPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const lens = normalizeBodyLens(getParam(searchParams, "lens"));
  const range = normalizeBodyRange(getParam(searchParams, "range"));

  const [zones, coverageOverview, injuries] = await Promise.all([
    getAllZonesWithState(),
    getCoverageOverviewModel(range),
    getInjuries(),
  ]);

  const triageInjuries = injuries.filter((i) => i.status === "ACTIVE" || i.status === "FLARED");
  const freshnessCounts = countByFreshness(zones);
  const needsAttention = buildNeedsAttention(zones);

  const selectedSection = coverageOverview.sections.find((e) => e.lens === lens) ?? coverageOverview.sections[0];
  const activeCategories = selectedSection.categories.filter((c) => c.totalCount > 0);

  const coverageHref = (nextLens: Exclude<CoverageLens, "sports">, nextRange: CoverageRange = range) =>
    `/body?lens=${nextLens}&range=${nextRange}`;

  return (
    <PageShell
      title="Body"
      subtitle="Track zone freshness, injuries, and training load by region. Tap a zone on the map for details."
      toolbar={
        <>
          <Link href="/body/log-pain" style={dangerLinkStyle}>Log pain</Link>
          <Link href="/injuries" style={linkStyle}>Injuries</Link>
        </>
      }
    >
      {triageInjuries.length > 0 && (
        <section style={injuryStripStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <div style={cardTitle}>Active injuries</div>
            <Link href="/injuries" style={smallLinkStyle}>view all →</Link>
          </div>
          <div style={injuryCardRow}>
            {triageInjuries.map((injury) => (
              <Link key={injury.id} href={`/injuries/${injury.id}`} style={injuryCardLink(injury.status)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 900, fontSize: 13 }}>{injury.name}</span>
                  <span style={statusPillStyle(injury.status)}>{injury.status === "ACTIVE" ? "Active" : "Flared"}</span>
                </div>
                <div style={injuryCardMeta}>
                  {injury.zones.map((z) => z.zone.label).join(" · ")}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <BodyStatusRow counts={freshnessCounts} totalZones={zones.length} />

      <BodyPageClient zones={zones} />

      <NeedsAttentionSection items={needsAttention} />

      <section style={coverageSectionStyle}>
        <div style={coverageHeaderStyle}>
          <div style={{ display: "grid", gap: 4 }}>
            <h2 style={cardTitle}>Coverage</h2>
            <div style={{ fontSize: 12, color: COLOR.textDim, lineHeight: 1.4 }}>
              {selectedSection.label} from completed logs in {coverageOverview.rangeLabel.toLowerCase()}.
            </div>
          </div>
        </div>

        <div style={coverageControlsStyle}>
          <div style={pillRowStyle}>
            {(["muscles", "patterns"] as const).map((item) => (
              <Link
                key={item}
                href={coverageHref(item)}
                scroll={false}
                style={{ ...pillStyle, ...(lens === item ? pillActiveStyle : {}) }}
              >
                {item === "muscles" ? "Muscle Groups" : "Movement Patterns"}
              </Link>
            ))}
          </div>
          <div style={pillRowStyle}>
            {[
              { key: "week" as CoverageRange, label: "7D" },
              { key: "2w" as CoverageRange, label: "2W" },
              { key: "4w" as CoverageRange, label: "4W" },
              { key: "12w" as CoverageRange, label: "12W" },
              { key: "ytd" as CoverageRange, label: "YTD" },
            ].map((item) => (
              <Link
                key={item.key}
                href={coverageHref(lens, item.key)}
                scroll={false}
                style={{ ...pillStyle, ...(range === item.key ? pillActiveStyle : {}) }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <CoverageGroupedBarChart
          categories={activeCategories}
          legend={coverageOverview.routineKindLegend}
          rangeLabel={coverageOverview.rangeLabel}
          emptyMessage={selectedSection.emptyMessage}
        />
      </section>
    </PageShell>
  );
}

// ─── Body status chip row ─────────────────────────────────────────────
// Compact at-a-glance summary above the body map. Each chip uses the same
// tint as the corresponding freshness state on the map, so the chips
// double as the map's legend. Zero-count states are hidden so the row
// stays tight when nothing is flagged.

type FreshnessCounts = Record<ZoneFreshness, number>;

function countByFreshness(zones: ZoneState[]): FreshnessCounts {
  const counts: FreshnessCounts = {
    FRESH: 0,
    WORKED_TODAY: 0,
    RECENTLY_WORKED: 0,
    RECOVERING: 0,
    INJURED: 0,
  };
  for (const zone of zones) counts[zone.freshness] += 1;
  return counts;
}

type StatusChipMeta = {
  key: ZoneFreshness;
  label: string;
  bg: string;
  border: string;
  color: string;
};

const STATUS_CHIPS: StatusChipMeta[] = [
  { key: "INJURED",         label: "Injured",          bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.42)", color: "#FCA5A5" },
  { key: "RECOVERING",      label: "Recovering",       bg: "rgba(147,197,253,0.16)", border: "rgba(147,197,253,0.34)", color: "#DBEAFE" },
  { key: "WORKED_TODAY",    label: "Worked today",     bg: "rgba(99,102,241,0.16)",  border: "rgba(129,140,248,0.36)", color: "#C7D2FE" },
  { key: "RECENTLY_WORKED", label: "Recently worked",  bg: "rgba(59,130,246,0.14)",  border: "rgba(96,165,250,0.32)",  color: "#BFDBFE" },
  { key: "FRESH",           label: "Fresh",            bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", color: COLOR.text },
];

function BodyStatusRow({ counts, totalZones }: { counts: FreshnessCounts; totalZones: number }) {
  // Render every state in the canonical order, but only the ones with a
  // non-zero count. If everything is FRESH (or no zones tracked) the row
  // still renders the Fresh chip so the user gets a "all good" signal.
  const visible = STATUS_CHIPS.filter((chip) => (counts[chip.key] ?? 0) > 0);
  const items = visible.length > 0 ? visible : STATUS_CHIPS.filter((chip) => chip.key === "FRESH");
  return (
    <section style={statusRowStyle} aria-label="Body zone status">
      <span style={statusRowLabel}>
        {totalZones} {totalZones === 1 ? "zone" : "zones"} tracked
      </span>
      <div style={chipRowInline}>
        {items.map((chip) => (
          <span
            key={chip.key}
            style={{
              ...statusChipStyle,
              background: chip.bg,
              borderColor: chip.border,
              color: chip.color,
            }}
          >
            <span style={statusChipCount}>{counts[chip.key]}</span>
            <span style={statusChipLabel}>{chip.label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

const statusRowStyle: React.CSSProperties = {
  ...cardSurface,
  padding: "10px 14px",
  gap: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
};

const statusRowLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: COLOR.textFaint,
  whiteSpace: "nowrap",
};

const chipRowInline: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const statusChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 10px",
  borderRadius: 8,
  border: "1px solid",
  fontSize: 12,
};

const statusChipCount: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
};

const statusChipLabel: React.CSSProperties = {
  fontWeight: 700,
  opacity: 0.92,
};

// ─── Needs attention ──────────────────────────────────────────────────
// Surfaces muscle groups that have been sitting cold (no logged work in
// 7+ days). Excludes anything injured or actively recovering — those are
// intentionally off, not neglected. Groups left/right zones together so
// the same muscle doesn't show up twice.

const COLD_THRESHOLD_DAYS = 7;
const NEEDS_ATTENTION_LIMIT = 4;

type NeedsAttentionItem = {
  groupSlug: string;
  label: string;
  // null = never seen worked in the 30-day window the zones query covers.
  daysSinceWorked: number | null;
  zoneCount: number;
};

function buildNeedsAttention(zones: ZoneState[]): NeedsAttentionItem[] {
  // Group by metadataGroupSlug; skip injured / recovering zones (those
  // have their own dedicated surfaces) and zones without a group mapping
  // (knees, joints, etc. don't represent a muscle group to "warm up").
  const buckets = new Map<string, { lastWorked: number | null; zoneCount: number }>();
  for (const zone of zones) {
    if (zone.freshness === "INJURED" || zone.freshness === "RECOVERING") continue;
    const slug = zone.groupSlug;
    if (!slug) continue;
    const entry = buckets.get(slug) ?? { lastWorked: null, zoneCount: 0 };
    entry.zoneCount += 1;
    // Track the *most-recently-worked* zone in the group as the group's
    // freshness — a single right-hamstring run counts the whole hamstring
    // group as recently worked even if the left one is cold.
    const days = zone.daysSinceWorked ?? null;
    if (days !== null && (entry.lastWorked === null || days < entry.lastWorked)) {
      entry.lastWorked = days;
    }
    buckets.set(slug, entry);
  }

  const items: NeedsAttentionItem[] = [];
  for (const [groupSlug, info] of buckets) {
    const days = info.lastWorked;
    // null = never worked in the 30-day window. Treat as cold.
    if (days === null || days >= COLD_THRESHOLD_DAYS) {
      items.push({
        groupSlug,
        label: prettifySlug(groupSlug),
        daysSinceWorked: days,
        zoneCount: info.zoneCount,
      });
    }
  }

  // Coldest first (null = "30+ days" → push to top).
  items.sort((a, b) => {
    const aDays = a.daysSinceWorked ?? 999;
    const bDays = b.daysSinceWorked ?? 999;
    if (aDays !== bDays) return bDays - aDays;
    return a.label.localeCompare(b.label);
  });

  return items.slice(0, NEEDS_ATTENTION_LIMIT);
}

function prettifySlug(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function NeedsAttentionSection({ items }: { items: NeedsAttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section style={attentionStyle} aria-label="Muscle groups that need attention">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={cardTitle}>Needs attention</div>
        <div style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700 }}>
          {COLD_THRESHOLD_DAYS}+ days since last loaded
        </div>
      </div>
      <div style={attentionRow}>
        {items.map((item) => (
          <div key={item.groupSlug} style={attentionItemStyle}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>{item.label}</div>
            <div style={attentionMeta}>
              {item.daysSinceWorked === null ? "30+ days" : `${item.daysSinceWorked} day${item.daysSinceWorked === 1 ? "" : "s"}`}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const attentionStyle: React.CSSProperties = {
  ...cardSurface,
  gap: 10,
};

const attentionRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 8,
};

const attentionItemStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(251,191,36,0.28)",
  background: "rgba(251,191,36,0.06)",
};

const attentionMeta: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#FDE68A",
  marginTop: 3,
  letterSpacing: 0.2,
};

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 36,
  alignItems: "center",
  border: `1px solid ${COLOR.borderStrong}`,
  borderRadius: RADIUS.control,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};

const dangerLinkStyle: React.CSSProperties = {
  ...linkStyle,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(248,113,113,0.08)",
};

const coverageSectionStyle: React.CSSProperties = {
  ...cardSurface,
  gap: 14,
};

const coverageHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  flexWrap: "wrap",
};

const coverageControlsStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 11px",
  borderRadius: RADIUS.pill,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};

const pillActiveStyle: React.CSSProperties = {
  background: "rgba(120,190,255,0.15)",
  borderColor: "rgba(120,190,255,0.45)",
  color: "#bfdbfe",
};

const injuryStripStyle: React.CSSProperties = {
  ...cardSurface,
  gap: 10,
};

const injuryCardRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const injuryCardMeta: React.CSSProperties = {
  fontSize: 11,
  color: COLOR.textFaint,
  fontWeight: 700,
  marginTop: 4,
  lineHeight: 1.4,
};

const smallLinkStyle: React.CSSProperties = {
  color: COLOR.text,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  opacity: 0.7,
  textDecoration: "none",
};

function injuryCardLink(status: InjuryStatus): React.CSSProperties {
  const flared = status === "FLARED";
  return {
    display: "grid",
    gap: 2,
    padding: "10px 12px",
    borderRadius: RADIUS.control,
    background: flared ? "rgba(251,146,60,0.07)" : "rgba(248,113,113,0.07)",
    border: flared ? "1px solid rgba(251,146,60,0.28)" : "1px solid rgba(248,113,113,0.28)",
    color: "inherit",
    textDecoration: "none",
    transition: "background 120ms",
    minWidth: 0,
  };
}

function statusPillStyle(status: InjuryStatus): React.CSSProperties {
  const flared = status === "FLARED";
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: RADIUS.pill,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.3,
    background: flared ? "rgba(251,146,60,0.18)" : "rgba(248,113,113,0.18)",
    border: flared ? "1px solid rgba(251,146,60,0.4)" : "1px solid rgba(248,113,113,0.4)",
    color: flared ? "#FED7AA" : "#FCA5A5",
  };
}
