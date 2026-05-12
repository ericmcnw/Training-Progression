// HomePageV2 — clean, graphic-forward home dashboard.
//
// Server component. Fetches all data via getHomeV2Data() and hands a single
// flat HomeV2Data bag to the client shell. Keeps the shell purely
// presentational so the server stays cacheable and the client side has
// clear inputs.
//
// To roll back to the previous home page: flip USE_HOME_V2 in app/page.tsx.

import HomeShell from "./_home-v2/HomeShell";
import { getHomeV2Data } from "./_home-v2/data";

export default async function HomePageV2() {
  const data = await getHomeV2Data();
  return <HomeShell data={data} />;
}
