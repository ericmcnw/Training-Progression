import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgressionDetail } from "../data";
import ProgressionLadder from "./ProgressionLadder";
import { page, topBar, backLink, title, subtitle, countTag, RungDots } from "../ui";

export const dynamic = "force-dynamic";

export default async function ProgressionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getProgressionDetail(id);
  if (!detail) notFound();

  return (
    <main style={page}>
      <div style={topBar}>
        <Link href="/progressions" style={backLink}>← Progressions</Link>
        <RungDots total={detail.total} done={detail.done} />
      </div>

      <header style={{ display: "grid", gap: 6 }}>
        <h1 style={title}>{detail.name}</h1>
        <p style={subtitle}>
          <span style={countTag}>{detail.done} of {detail.total} done</span>
          {detail.notes ? ` · ${detail.notes}` : null}
        </p>
      </header>

      {detail.rungs.length === 0 ? (
        <p style={subtitle}>No steps yet.</p>
      ) : (
        <ProgressionLadder rungs={detail.rungs} currentId={detail.currentId} />
      )}
    </main>
  );
}
