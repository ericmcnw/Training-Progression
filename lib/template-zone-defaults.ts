import { prisma } from "@/lib/prisma";

export type TemplateZoneDefault = {
  slug: string;
  label: string;
  sortOrder: number;
};

/**
 * Resolves a session template's metadata groups into the body zones that
 * should be pre-tagged when logging a session of this template.
 *
 * Expansion rules:
 *  - Take all metadata slugs directly attached to the template.
 *  - Walk MetadataGroupRelation downward to gather every descendant whose
 *    `kind === "MUSCLE_GROUP"`. This lets a tag like "back" pick up
 *    upper-back / lats / lower-back without listing each one on the seed.
 *  - Resolve the union of those slugs to BodyZones via
 *    `BodyZone.metadataGroupSlug`.
 */
export async function getTemplateDefaultZones(templateId: string): Promise<TemplateZoneDefault[]> {
  const muscleSlugs = await collectMuscleGroupSlugs(templateId);
  if (muscleSlugs.size === 0) return [];

  const zones = await prisma.bodyZone.findMany({
    where: { metadataGroupSlug: { in: Array.from(muscleSlugs) } },
    select: { slug: true, label: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return zones;
}

export async function getTemplateDefaultZonesByKey(templateKey: string): Promise<TemplateZoneDefault[]> {
  const template = await prisma.sessionTemplate.findUnique({
    where: { key: templateKey },
    select: { id: true },
  });
  if (!template) return [];
  return getTemplateDefaultZones(template.id);
}

async function collectMuscleGroupSlugs(templateId: string): Promise<Set<string>> {
  const templateGroups = await prisma.sessionTemplateMetadataGroup.findMany({
    where: { templateId },
    select: { group: { select: { id: true, slug: true, kind: true } } },
  });
  if (templateGroups.length === 0) return new Set();

  // Pull every parent→child relation up-front, then BFS from seed groups.
  // The graph is small (under 200 nodes), so a single fetch is cheaper than
  // round-tripping each descendant lookup.
  const relations = await prisma.metadataGroupRelation.findMany({
    select: {
      parentGroupId: true,
      childGroup: { select: { id: true, slug: true, kind: true } },
    },
  });
  const childrenByParentId = new Map<string, Array<{ id: string; slug: string; kind: string }>>();
  for (const rel of relations) {
    const list = childrenByParentId.get(rel.parentGroupId) ?? [];
    list.push(rel.childGroup);
    childrenByParentId.set(rel.parentGroupId, list);
  }

  const muscleSlugs = new Set<string>();
  const visited = new Set<string>();
  const queue: Array<{ id: string; slug: string; kind: string }> = templateGroups.map((tg) => tg.group);

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    if (node.kind === "MUSCLE_GROUP") muscleSlugs.add(node.slug);
    const children = childrenByParentId.get(node.id) ?? [];
    for (const child of children) {
      if (!visited.has(child.id)) queue.push(child);
    }
  }

  return muscleSlugs;
}
