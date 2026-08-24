import { redirect } from "next/navigation";

export default async function LegacyFocusEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/programs/${encodeURIComponent(id)}/edit`);
}
