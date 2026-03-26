"use client";

import dynamic from "next/dynamic";

const WeeklyMomentumSectionBoundary = dynamic(() => import("./WeeklyMomentumSectionClient"), {
  ssr: false,
});

export default WeeklyMomentumSectionBoundary;
