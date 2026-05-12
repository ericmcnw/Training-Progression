// Home route entry point.
//
// Flip USE_HOME_V2 to revert to the legacy dashboard. The legacy code is
// preserved verbatim in app/HomePageLegacy.tsx — to roll back, change the
// constant below to `false` and the original page renders unchanged.
//
// Both variants share the same `dynamic = "force-dynamic"` rendering mode
// (fresh data every request) — declared here so it applies regardless of
// which component is selected.

import HomePageLegacy from "./HomePageLegacy";
import HomePageV2 from "./HomePageV2";

export const dynamic = "force-dynamic";

const USE_HOME_V2 = true;

export default async function HomePage() {
  return USE_HOME_V2 ? <HomePageV2 /> : <HomePageLegacy />;
}
