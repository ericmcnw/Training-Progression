import type { MetadataGroupKind } from "@/generated/prisma";

export type VirtualSportCategory = {
  slug: string;
  label: string;
  subtype: string;
  eyebrow: string;
};

export const VIRTUAL_SPORT_CATEGORIES: VirtualSportCategory[] = [
  { slug: "surfing", label: "Surfing", subtype: "SURFING", eyebrow: "Board sport" },
  { slug: "snowboarding", label: "Snowboarding", subtype: "SNOWBOARDING", eyebrow: "Board sport" },
];

const EXCLUDED_SPORT_SLUGS = new Set(["cardio", "run-walk"]);
const SPORTS_TRAINING_GROUP_SLUGS = new Set(["climbing", "board-sports"]);

export function isSportGroup(input: { kind: MetadataGroupKind; slug: string }) {
  if (EXCLUDED_SPORT_SLUGS.has(input.slug)) return false;
  return input.kind === "CARDIO_ACTIVITY" || SPORTS_TRAINING_GROUP_SLUGS.has(input.slug);
}

export function isVirtualSportSlug(slug: string) {
  return VIRTUAL_SPORT_CATEGORIES.some((item) => item.slug === slug);
}

export function getVirtualSportCategory(slug: string) {
  return VIRTUAL_SPORT_CATEGORIES.find((item) => item.slug === slug) ?? null;
}

export function sportTargetHref(slug: string) {
  // Phase 2: sport target pages live under /activities/[slug] now.
  // /progress/sports/[slug] still works via redirect for old bookmarks.
  return `/activities/${slug}?tab=overview&range=4w`;
}

export function sportGroupTargetHref(input: { slug: string }) {
  return sportTargetHref(input.slug);
}

export function sportGroupKindLabel(input: { kind: MetadataGroupKind; slug: string }) {
  if (input.slug === "climbing") return "Climbing";
  if (input.kind === "CARDIO_ACTIVITY") return "Cardio sport";
  return "Sport group";
}
