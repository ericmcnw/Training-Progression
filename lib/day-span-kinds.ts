// Trip / time-away kind metadata — the fixed set of DaySpan kinds plus their
// default emoji + band color. Pure (no server imports) so both server loaders
// (lib/day-spans.ts) and client UI (TripEditorPopover, MonthCalendar,
// WeekAtGlance) can share it. A DaySpan may also carry a free custom `icon`
// that overrides the kind's default emoji — see daySpanDisplayIcon.

export type DaySpanKind = {
  value: string;
  label: string;
  icon: string;
  /** RGB triple for band tint / border. */
  rgb: string;
};

export const DAY_SPAN_KINDS: DaySpanKind[] = [
  { value: "vacation", label: "Vacation", icon: "🏖️", rgb: "251,191,36" },
  { value: "travel", label: "Travel", icon: "✈️", rgb: "96,165,250" },
  { value: "away", label: "Away", icon: "📍", rgb: "148,163,184" },
  { value: "sick", label: "Sick", icon: "🤒", rgb: "244,114,182" },
  { value: "rest", label: "Rest", icon: "😴", rgb: "52,211,153" },
];

const KIND_BY_VALUE = new Map(DAY_SPAN_KINDS.map((k) => [k.value, k]));

export function daySpanIcon(kind: string): string {
  return KIND_BY_VALUE.get(kind)?.icon ?? "📍";
}

export function daySpanRgb(kind: string): string {
  return KIND_BY_VALUE.get(kind)?.rgb ?? "148,163,184";
}

/** The emoji to actually render for a span: its custom icon when set,
 *  otherwise the kind default. */
export function daySpanDisplayIcon(kind: string, icon?: string | null): string {
  const trimmed = icon?.trim();
  return trimmed || daySpanIcon(kind);
}

// Handy one-tap emoji for the trip editor — beach/travel/family flavors.
export const TRIP_QUICK_EMOJI = ["🦈", "🏖️", "🌊", "🏔️", "🏕️", "🎶", "🎉", "🏠", "🍺", "❤️"];
