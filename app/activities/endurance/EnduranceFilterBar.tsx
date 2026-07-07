"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

// One filter bar for the endurance page: an Activity picker (family + type
// merged into a single grouped select) and a Range control. Replaces the
// stacked family-tab row + type sub-pill row + separate range row — and the
// range now drives the CHARTS too, not just the stats/lists below.

export type FilterFamily = {
  slug: string;
  name: string;
  sessions: number;
  types: Array<{ slug: string; name: string }>;
};

const RANGES: Array<{ value: "4w" | "12w" | "all"; label: string }> = [
  { value: "4w", label: "4w" },
  { value: "12w", label: "12w" },
  { value: "all", label: "All" },
];

export default function EnduranceFilterBar({
  families,
  familySlug,
  typeSlug,
  range,
}: {
  families: FilterFamily[];
  familySlug: string;
  typeSlug: string | null;
  range: "4w" | "12w" | "all";
}) {
  const router = useRouter();

  function hrefFor(nextFamily: string, nextType: string | null, nextRange: string) {
    const params = new URLSearchParams();
    if (nextFamily !== "overview") params.set("family", nextFamily);
    if (nextType) params.set("type", nextType);
    if (nextRange !== "4w") params.set("range", nextRange);
    const qs = params.toString();
    return `/activities/endurance${qs ? `?${qs}` : ""}`;
  }

  const selectValue = typeSlug ? `t:${familySlug}:${typeSlug}` : familySlug === "overview" ? "overview" : `f:${familySlug}`;

  function onActivityChange(value: string) {
    if (value === "overview") {
      router.push(hrefFor("overview", null, range));
    } else if (value.startsWith("f:")) {
      router.push(hrefFor(value.slice(2), null, range));
    } else if (value.startsWith("t:")) {
      const [, family, type] = value.split(":");
      router.push(hrefFor(family, type, range));
    }
  }

  return (
    <div style={barStyle}>
      <select
        value={selectValue}
        onChange={(e) => onActivityChange(e.target.value)}
        style={selectStyle}
        aria-label="Activity filter"
      >
        <option value="overview">All endurance · Overview</option>
        {families.map((f) => (
          <optgroup key={f.slug} label={f.name}>
            <option value={`f:${f.slug}`}>
              All {f.name}
              {f.sessions > 0 ? ` (${f.sessions})` : ""}
            </option>
            {f.types.map((t) => (
              <option key={t.slug} value={`t:${f.slug}:${t.slug}`}>
                {t.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div style={rangeGroupStyle} role="tablist" aria-label="Range">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            role="tab"
            aria-selected={range === r.value}
            onClick={() => router.push(hrefFor(familySlug, typeSlug, r.value))}
            style={range === r.value ? rangeBtnActive : rangeBtn}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const barStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

// 16px font — iOS Safari focus-zoom guard.
const selectStyle: CSSProperties = {
  flex: 1,
  minWidth: 200,
  maxWidth: 360,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "#111827",
  color: "inherit",
  fontSize: 16,
  fontWeight: 700,
  minHeight: 44,
  cursor: "pointer",
};

const rangeGroupStyle: CSSProperties = {
  display: "inline-flex",
  gap: 2,
  padding: 2,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  flexShrink: 0,
};

const rangeBtn: CSSProperties = {
  minHeight: 36,
  padding: "6px 14px",
  borderRadius: 999,
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  opacity: 0.6,
  fontFamily: "inherit",
};

const rangeBtnActive: CSSProperties = {
  ...rangeBtn,
  background: "rgba(78,148,255,0.18)",
  color: "rgba(191,219,254,0.98)",
  opacity: 1,
};
