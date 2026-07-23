// Gear-type registry — the presets behind the picker's typeable type dropdown.
// Each type carries its icon, scope (universal vs activity-scoped), the
// activities it belongs to, and the natural lifetime unit used by the future
// usage rollups (Phase 2). Free-typed custom types aren't here; they default to
// activity-scoped with a generic icon + "sessions" unit.

export type GearUnit = "miles" | "nights" | "days" | "sessions";
export type GearScope = "universal" | "activity";

export type GearTypePreset = {
  /** Stable slug stored on Gear.type. */
  value: string;
  label: string;
  icon: string;
  scope: GearScope;
  /** Activities this type belongs to (activity-scoped only). */
  activities?: string[];
  /** Natural lifetime unit for usage rollups. */
  unit: GearUnit;
};

export const GEAR_TYPES: GearTypePreset[] = [
  { value: "footwear", label: "Footwear", icon: "👟", scope: "universal", unit: "miles" },
  { value: "clothing", label: "Clothing", icon: "🧥", scope: "universal", unit: "sessions" },
  { value: "watch", label: "Watch / device", icon: "⌚", scope: "universal", unit: "sessions" },
  { value: "pack", label: "Pack", icon: "🎒", scope: "activity", activities: ["backpacking", "hiking"], unit: "nights" },
  { value: "tent", label: "Tent / shelter", icon: "⛺", scope: "activity", activities: ["backpacking"], unit: "nights" },
  { value: "sleeping-bag", label: "Sleeping bag", icon: "🛌", scope: "activity", activities: ["backpacking"], unit: "nights" },
  { value: "sleeping-pad", label: "Sleeping pad", icon: "🟦", scope: "activity", activities: ["backpacking"], unit: "nights" },
  { value: "stove", label: "Stove", icon: "🔥", scope: "activity", activities: ["backpacking"], unit: "nights" },
  { value: "cookware", label: "Cookware", icon: "🍳", scope: "activity", activities: ["backpacking"], unit: "nights" },
  { value: "water", label: "Water / filter", icon: "💧", scope: "activity", activities: ["backpacking"], unit: "nights" },
  { value: "snowboard", label: "Snowboard", icon: "🏂", scope: "activity", activities: ["snowboarding"], unit: "days" },
  { value: "skis", label: "Skis", icon: "🎿", scope: "activity", activities: ["skiing"], unit: "days" },
  { value: "surfboard", label: "Surfboard", icon: "🏄", scope: "activity", activities: ["surfing", "bodysurfing", "wakesurfing"], unit: "sessions" },
  { value: "skateboard", label: "Skateboard", icon: "🛹", scope: "activity", activities: ["skateboarding"], unit: "sessions" },
  { value: "other", label: "Other", icon: "📦", scope: "universal", unit: "sessions" },
];

const BY_VALUE = new Map(GEAR_TYPES.map((t) => [t.value, t]));
const BY_LABEL = new Map(GEAR_TYPES.map((t) => [t.label.toLowerCase(), t]));

/** Slugify any free-typed type input ("Trekking Poles" → "trekking-poles"). */
export function slugifyGearType(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve a raw type input (a preset label, a preset slug, or free text) to a
 *  stable type slug. */
export function resolveGearTypeSlug(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "other";
  const byLabel = BY_LABEL.get(trimmed.toLowerCase());
  if (byLabel) return byLabel.value;
  if (BY_VALUE.has(trimmed)) return trimmed;
  return slugifyGearType(trimmed) || "other";
}

/** Display metadata for a stored type slug — preset if known, else a prettified
 *  fallback so custom types still render an icon + readable label. */
export function gearTypeMeta(typeSlug: string): { label: string; icon: string; unit: GearUnit; scope: GearScope } {
  const preset = BY_VALUE.get(typeSlug);
  if (preset) return { label: preset.label, icon: preset.icon, unit: preset.unit, scope: preset.scope };
  const label = typeSlug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
  return { label: label || "Gear", icon: "📦", unit: "sessions", scope: "activity" };
}

export function isUniversalGearType(typeSlug: string): boolean {
  return gearTypeMeta(typeSlug).scope === "universal";
}

/** Preset types offered in the picker for a given activity: universal types +
 *  any whose `activities` includes the slug. */
export function gearTypesForActivity(activitySlug: string): GearTypePreset[] {
  return GEAR_TYPES.filter((t) => t.scope === "universal" || (t.activities ?? []).includes(activitySlug));
}
