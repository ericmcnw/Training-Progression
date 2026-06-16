import { PrismaClient } from "../generated/prisma/index.js";

const standalonePrisma = new PrismaClient();

export const bodyZones = [
  { slug: "left-shoulder-front", label: "Left Shoulder (front)", region: "shoulder", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: "shoulders", sortOrder: 10 },
  { slug: "right-shoulder-front", label: "Right Shoulder (front)", region: "shoulder", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: "shoulders", sortOrder: 11 },
  { slug: "left-chest", label: "Left Chest", region: "chest", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: "chest", sortOrder: 20 },
  { slug: "right-chest", label: "Right Chest", region: "chest", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: "chest", sortOrder: 21 },
  { slug: "left-bicep", label: "Left Bicep", region: "bicep", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: "biceps", sortOrder: 30 },
  { slug: "right-bicep", label: "Right Bicep", region: "bicep", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: "biceps", sortOrder: 31 },
  { slug: "left-forearm-front", label: "Left Forearm", region: "forearm", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: "forearms", sortOrder: 40 },
  { slug: "right-forearm-front", label: "Right Forearm", region: "forearm", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: "forearms", sortOrder: 41 },
  { slug: "left-fingers", label: "Left Fingers", region: "fingers", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: "fingers", sortOrder: 43 },
  { slug: "right-fingers", label: "Right Fingers", region: "fingers", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: "fingers", sortOrder: 44 },
  { slug: "left-hip-flexor", label: "Left Hip Flexor", region: "hip-flexor", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: "hip-flexors", sortOrder: 50 },
  { slug: "right-hip-flexor", label: "Right Hip Flexor", region: "hip-flexor", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: "hip-flexors", sortOrder: 51 },
  { slug: "left-quad", label: "Left Quad", region: "quad", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: "quads", sortOrder: 60 },
  { slug: "right-quad", label: "Right Quad", region: "quad", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: "quads", sortOrder: 61 },
  { slug: "left-adductor", label: "Left Adductor", region: "adductor", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: "adductors", sortOrder: 70 },
  { slug: "right-adductor", label: "Right Adductor", region: "adductor", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: "adductors", sortOrder: 71 },
  { slug: "left-knee-front", label: "Left Knee", region: "knee", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: null, sortOrder: 80 },
  { slug: "right-knee-front", label: "Right Knee", region: "knee", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: null, sortOrder: 81 },
  { slug: "left-shin", label: "Left Shin", region: "shin", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: "tibialis", sortOrder: 90 },
  { slug: "right-shin", label: "Right Shin", region: "shin", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: "tibialis", sortOrder: 91 },
  // Ankle joints — joints have no muscle metadata group (like knees/achilles).
  { slug: "left-ankle", label: "Left Ankle", region: "ankle", side: "LEFT", bodyView: "FRONT", metadataGroupSlug: null, sortOrder: 95 },
  { slug: "right-ankle", label: "Right Ankle", region: "ankle", side: "RIGHT", bodyView: "FRONT", metadataGroupSlug: null, sortOrder: 96 },
  { slug: "abs", label: "Abdominals", region: "abs", side: "CENTRAL", bodyView: "FRONT", metadataGroupSlug: "abs", sortOrder: 25 },
  { slug: "obliques", label: "Obliques", region: "oblique", side: "BILATERAL", bodyView: "FRONT", metadataGroupSlug: "obliques", sortOrder: 26 },
  { slug: "neck-front", label: "Neck (front)", region: "neck", side: "CENTRAL", bodyView: "FRONT", metadataGroupSlug: "neck", sortOrder: 5 },
  { slug: "left-shoulder-back", label: "Left Shoulder (back)", region: "shoulder", side: "LEFT", bodyView: "BACK", metadataGroupSlug: "shoulders", sortOrder: 110 },
  { slug: "right-shoulder-back", label: "Right Shoulder (back)", region: "shoulder", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: "shoulders", sortOrder: 111 },
  { slug: "left-upper-back", label: "Left Upper Back", region: "upper-back", side: "LEFT", bodyView: "BACK", metadataGroupSlug: "upper-back", sortOrder: 120 },
  { slug: "right-upper-back", label: "Right Upper Back", region: "upper-back", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: "upper-back", sortOrder: 121 },
  { slug: "left-lat", label: "Left Lat", region: "lat", side: "LEFT", bodyView: "BACK", metadataGroupSlug: "lats", sortOrder: 130 },
  { slug: "right-lat", label: "Right Lat", region: "lat", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: "lats", sortOrder: 131 },
  { slug: "left-tricep", label: "Left Tricep", region: "tricep", side: "LEFT", bodyView: "BACK", metadataGroupSlug: "triceps", sortOrder: 140 },
  { slug: "right-tricep", label: "Right Tricep", region: "tricep", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: "triceps", sortOrder: 141 },
  { slug: "left-forearm-back", label: "Left Forearm (back)", region: "forearm", side: "LEFT", bodyView: "BACK", metadataGroupSlug: "forearms", sortOrder: 150 },
  { slug: "right-forearm-back", label: "Right Forearm (back)", region: "forearm", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: "forearms", sortOrder: 151 },
  { slug: "left-glute", label: "Left Glute", region: "glute", side: "LEFT", bodyView: "BACK", metadataGroupSlug: "glutes", sortOrder: 160 },
  { slug: "right-glute", label: "Right Glute", region: "glute", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: "glutes", sortOrder: 161 },
  { slug: "left-lateral-hip", label: "Left Lateral Hip (Glute Med)", region: "hip-lateral", side: "LEFT", bodyView: "BACK", metadataGroupSlug: "glute-medius", sortOrder: 170 },
  { slug: "right-lateral-hip", label: "Right Lateral Hip (Glute Med)", region: "hip-lateral", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: "glute-medius", sortOrder: 171 },
  { slug: "left-hamstring-proximal", label: "Left Hamstring (proximal)", region: "hamstring", side: "LEFT", bodyView: "BACK", metadataGroupSlug: "hamstrings", sortOrder: 180 },
  { slug: "right-hamstring-proximal", label: "Right Hamstring (proximal)", region: "hamstring", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: "hamstrings", sortOrder: 181 },
  { slug: "left-hamstring-distal", label: "Left Hamstring (distal)", region: "hamstring", side: "LEFT", bodyView: "BACK", metadataGroupSlug: "hamstrings", sortOrder: 190 },
  { slug: "right-hamstring-distal", label: "Right Hamstring (distal)", region: "hamstring", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: "hamstrings", sortOrder: 191 },
  { slug: "left-calf", label: "Left Calf", region: "calf", side: "LEFT", bodyView: "BACK", metadataGroupSlug: "calves", sortOrder: 200 },
  { slug: "right-calf", label: "Right Calf", region: "calf", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: "calves", sortOrder: 201 },
  { slug: "left-achilles", label: "Left Achilles", region: "achilles", side: "LEFT", bodyView: "BACK", metadataGroupSlug: null, sortOrder: 210 },
  { slug: "right-achilles", label: "Right Achilles", region: "achilles", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: null, sortOrder: 211 },
  { slug: "left-knee-back", label: "Left Knee (back)", region: "knee", side: "LEFT", bodyView: "BACK", metadataGroupSlug: null, sortOrder: 220 },
  { slug: "right-knee-back", label: "Right Knee (back)", region: "knee", side: "RIGHT", bodyView: "BACK", metadataGroupSlug: null, sortOrder: 221 },
  { slug: "neck-back", label: "Neck (back)", region: "neck", side: "CENTRAL", bodyView: "BACK", metadataGroupSlug: "neck", sortOrder: 105 },
  { slug: "upper-spine", label: "Upper Spine", region: "spine", side: "CENTRAL", bodyView: "BACK", metadataGroupSlug: null, sortOrder: 115 },
  { slug: "mid-spine", label: "Mid Spine (thoracic)", region: "spine", side: "CENTRAL", bodyView: "BACK", metadataGroupSlug: null, sortOrder: 125 },
  { slug: "lower-back", label: "Lower Back (lumbar)", region: "lower-back", side: "CENTRAL", bodyView: "BACK", metadataGroupSlug: "lower-back", sortOrder: 135 },
];

export async function seedBodyZones(prisma = standalonePrisma) {
  const candidateSlugs = [...new Set(bodyZones.map((zone) => zone.metadataGroupSlug).filter(Boolean))];
  const existingGroups = await prisma.metadataGroup.findMany({
    where: {
      kind: "MUSCLE_GROUP",
      slug: { in: candidateSlugs },
    },
    select: { slug: true },
  });
  const existingSlugs = new Set(existingGroups.map((group) => group.slug));
  const missingSlugs = candidateSlugs.filter((slug) => !existingSlugs.has(slug));
  if (missingSlugs.length > 0) {
    console.warn(`Body zone metadata groups missing and left unmapped: ${missingSlugs.join(", ")}`);
  }

  for (const zone of bodyZones) {
    await prisma.bodyZone.upsert({
      where: { slug: zone.slug },
      update: {
        label: zone.label,
        region: zone.region,
        side: zone.side,
        bodyView: zone.bodyView,
        metadataGroupSlug: zone.metadataGroupSlug && existingSlugs.has(zone.metadataGroupSlug) ? zone.metadataGroupSlug : null,
        sortOrder: zone.sortOrder,
      },
      create: {
        slug: zone.slug,
        label: zone.label,
        region: zone.region,
        side: zone.side,
        bodyView: zone.bodyView,
        metadataGroupSlug: zone.metadataGroupSlug && existingSlugs.has(zone.metadataGroupSlug) ? zone.metadataGroupSlug : null,
        sortOrder: zone.sortOrder,
      },
    });
  }

  console.log(`Seeded ${bodyZones.length} body zones.`);
  return bodyZones.length;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/prisma/seed-body-zones.mjs")) {
  seedBodyZones()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await standalonePrisma.$disconnect();
    });
}
