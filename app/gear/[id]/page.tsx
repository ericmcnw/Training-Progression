import { notFound } from "next/navigation";
import { getGear } from "@/lib/gear";
import { getGearUsage } from "@/lib/gear-usage";
import GearDetailEditor from "./GearDetailEditor";

export const dynamic = "force-dynamic";

export default async function GearDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gear = await getGear(id);
  if (!gear) notFound();

  const usageMap = await getGearUsage([gear.id]);
  const usage = usageMap.get(gear.id) ?? null;

  return (
    <GearDetailEditor
      id={gear.id}
      name={gear.name}
      type={gear.type}
      weightGrams={gear.weightGrams}
      activitySlug={gear.activitySlug}
      consumable={gear.consumable}
      worn={gear.worn}
      retired={Boolean(gear.retiredAt)}
      usage={usage}
    />
  );
}
