import { notFound } from "next/navigation";
import BodyMap from "@/app/components/body-map/BodyMap";
import { allBodyZonePaths } from "@/app/components/body-map/bodyZonePaths";
import type { ZoneFreshness, ZoneState } from "@/app/components/body-map/types";

const freshnessCycle: ZoneFreshness[] = ["FRESH", "WORKED_TODAY", "RECENTLY_WORKED", "RECOVERING", "INJURED"];

export default function BodyMapDevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const zones: ZoneState[] = allBodyZonePaths.map((zone, index) => ({
    slug: zone.slug,
    freshness: freshnessCycle[index % freshnessCycle.length],
    painLevel: index % freshnessCycle.length === 4 ? 6 : undefined,
    activityCount: index % 6,
  }));

  return (
    <main className="grid gap-6">
      <section className="grid gap-2">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">Body map test</p>
        <h1 className="text-3xl font-black">Body Map</h1>
        <p className="max-w-2xl text-sm leading-6 text-white/68">Mock state across every seeded body zone.</p>
      </section>
      <section className="rounded-[18px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
        <BodyMap zones={zones} selectable selectedSlugs={["left-hamstring-proximal", "right-shoulder-front"]} size="lg" />
      </section>
      <section className="grid gap-4 rounded-[18px] border border-white/10 bg-white/[0.04] p-5 md:grid-cols-2">
        <BodyMap zones={zones} view="front" size="md" />
        <BodyMap zones={zones} view="back" size="md" />
      </section>
    </main>
  );
}
