import { notFound } from "next/navigation";
import { getGearList } from "@/lib/gear-lists";
import { getAllGear } from "@/lib/gear";
import GearListEditor from "./GearListEditor";

export const dynamic = "force-dynamic";

export default async function GearListEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [list, gear] = await Promise.all([getGearList(id), getAllGear()]);
  if (!list) notFound();

  const availableGear = gear
    .filter((g) => !g.retiredAt)
    .map((g) => ({ id: g.id, type: g.type, name: g.name, weightGrams: g.weightGrams }));

  return (
    <GearListEditor
      listId={list.id}
      name={list.name}
      activitySlug={list.activitySlug}
      notes={list.notes}
      items={list.items}
      availableGear={availableGear}
    />
  );
}
