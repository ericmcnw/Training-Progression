import type { MetadataGroupKind } from "@/generated/prisma";

const EXCLUDED_SPORT_SLUGS = new Set(["cardio", "run-walk"]);
const SPORTS_TRAINING_GROUP_SLUGS = new Set(["climbing", "board-sports"]);

export function isSportGroup(input: { kind: MetadataGroupKind; slug: string }) {
  if (EXCLUDED_SPORT_SLUGS.has(input.slug)) return false;
  return input.kind === "CARDIO_ACTIVITY" || SPORTS_TRAINING_GROUP_SLUGS.has(input.slug);
}

export function sportGroupTargetHref(input: { kind: MetadataGroupKind; slug: string }) {
  return input.kind === "CARDIO_ACTIVITY"
    ? `/progress/cardio/${input.slug}?tab=overview&range=4w`
    : `/progress/groups/${input.slug}?tab=overview&range=4w`;
}

export function sportGroupKindLabel(input: { kind: MetadataGroupKind; slug: string }) {
  if (input.slug === "climbing") return "Climbing";
  if (input.kind === "CARDIO_ACTIVITY") return "Cardio sport";
  return "Sport group";
}
