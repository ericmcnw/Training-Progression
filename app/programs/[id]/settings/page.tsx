import { redirect } from "next/navigation";

export default async function LegacyProgramSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/programs/${encodeURIComponent(id)}/edit`);
}
