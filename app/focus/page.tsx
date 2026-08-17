import { redirect } from "next/navigation";

// Focus is the schema noun; Programs is the surfaced one. This catches the
// bare URL and sends it to the real index.
export default function FocusIndexPage() {
  redirect("/programs");
}
