import { redirect } from "next/navigation";

// /activities/body-work was a Phase 1 stub whose feature list (body
// status and injuries) now lives under Profile / Health. Keep the old URL
// alive for bookmarks without making the body map a primary destination.
export const dynamic = "force-dynamic";

export default function BodyWorkRedirect() {
  redirect("/profile/health");
}
