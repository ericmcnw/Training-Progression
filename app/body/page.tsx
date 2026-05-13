import Link from "next/link";
import { getAllZonesWithState } from "@/lib/body-zones";
import BodyPageClient from "./BodyPageClient";
import { getCoverageOverviewModel, type CoverageLens, type CoverageRange } from "@/app/progress/coverage";
import CoverageGroupedBarChart from "@/app/progress/CoverageGroupedBarChart";

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

  const [zones, coverageOverview] = await Promise.all([
    getAllZonesWithState(),
    getCoverageOverviewModel(range),
  ]);

  const selectedSection = coverageOverview.sections.find((e) => e.lens === lens) ?? coverageOverview.sections[0];
  const activeCategories = selectedSection.categories.filter((c) => c.totalCount > 0);

  const coverageHref = (nextLens: Exclude<CoverageLens, "sports">, nextRange: CoverageRange = range) =>
    `/body?lens=${nextLens}&range=${nextRange}`;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.08 }}>Body</h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/body/log-pain" style={linkStyle}>Log pain</Link>
          <Link href="/injuries" style={linkStyle}>Injuries</Link>
        </div>
      </div>
      <BodyPageClient zones={zones} />

      <section style={coverageSectionStyle}>
        <div style={coverageHeaderStyle}>
          <div style={{ display: "grid", gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Coverage</h2>
            <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
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

const coverageSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "linear-gradient(180deg, rgba(20,29,46,0.9), rgba(13,19,31,0.92))",
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
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
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
