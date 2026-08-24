import { redirect } from "next/navigation";

// Injuries have no index surface — Profile / Health is their hub. This catches
// the bare URL (nav match covers /injuries/*) so it doesn't 404.
export default function InjuriesIndexPage() {
  redirect("/profile/health");
}
