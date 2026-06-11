import { redirect } from "next/navigation";

// /activities/body-work was a Phase 1 stub whose feature list (body
// status, injuries list, mobility chart, zone coverage) already lives
// on /body, /injuries, and the rewritten /activities/mobility. The URL
// stays alive for legacy bookmarks; users land on /body which is the
// real body-status surface.
export const dynamic = "force-dynamic";

export default function BodyWorkRedirect() {
  redirect("/body");
}
