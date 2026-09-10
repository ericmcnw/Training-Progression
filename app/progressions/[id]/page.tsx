import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgressionDetail } from "../data";
import ProgressionLadder from "./ProgressionLadder";
import ProgressionHeader from "./ProgressionHeader";
import { page, topBar, backLink, subtitle, countTag, RungDots } from "../ui";

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

      <ProgressionHeader id={detail.id} name={detail.name} />

      <p style={{ ...subtitle, margin: 0 }}>
        <span style={countTag}>{detail.done} of {detail.total} done</span>
      </p>

      <ProgressionLadder
        progressionId={detail.id}
        rungs={detail.rungs}
        currentId={detail.currentId}
      />
    </main>
  );
}
