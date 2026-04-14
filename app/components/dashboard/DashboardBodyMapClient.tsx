"use client";

import { useRouter } from "next/navigation";
import BodyMap from "@/app/components/body-map/BodyMap";
import type { ZoneState } from "@/app/components/body-map/types";

export default function DashboardBodyMapClient({ zones }: { zones: ZoneState[] }) {
  const router = useRouter();

  return (
    <BodyMap
      zones={zones}
      size="sm"
      onZoneClick={(slug) => router.push(`/body/${slug}`)}
      onZoneHover={() => undefined}
    />
  );
}
