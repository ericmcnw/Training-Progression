import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const areas = await prisma.climbArea.findMany({
  where: { name: { in: ["Next to Summer Slab", "Near Slab Wall"] } },
  include: {
    location: { select: { name: true } },
    _count: { select: { attempts: true } },
  },
});

console.log(
  areas.map((a) => ({
    id: a.id,
    name: a.name,
    location: a.location.name,
    locationId: a.locationId,
    attempts: a._count.attempts,
  }))
);

if (areas.length !== 2) {
  console.log("Expected exactly 2 areas, found", areas.length, "- aborting");
  process.exit(1);
}
if (areas[0].locationId !== areas[1].locationId) {
  console.log("Areas are at different locations - aborting");
  process.exit(1);
}

const keep = areas.find((a) => a.name === "Near Slab Wall");
const drop = areas.find((a) => a.name === "Next to Summer Slab");

console.log(`Plan: move ${drop._count.attempts} attempt(s) from "${drop.name}" -> "${keep.name}", then delete "${drop.name}"`);

if (apply) {
  await prisma.$transaction([
    prisma.climbAttempt.updateMany({
      where: { OR: [{ areaId: drop.id }, { area: drop.name }] },
      data: { areaId: keep.id, area: keep.name },
    }),
    prisma.climbArea.delete({ where: { id: drop.id } }),
  ]);
  console.log("Applied.");
} else {
  console.log("Dry run - rerun with --apply");
}

await prisma.$disconnect();
