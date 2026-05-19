// Home route entry point. Server component — fetches a flat data bag and
// hands it to HomeShell. HomeShell is purely presentational so the server
// half stays cacheable and the client half has clear inputs.

import HomeShell from "./_home/HomeShell";
import { getHomeData } from "./_home/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getHomeData();
  return <HomeShell data={data} />;
}
