import { redirect } from "next/navigation";

// One create surface, at /programs/new.
export default function NewFocusPage() {
  redirect("/programs/new");
}
