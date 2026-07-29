import { redirect } from "next/navigation";

// Focus has no index surface — the Plan page's Year band is where focuses
// live. This catches the bare URL so it doesn't 404.
export default function FocusIndexPage() {
  redirect("/plan");
}
