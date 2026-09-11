import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgressionDetail, getExerciseOptions } from "../data";
import ProgressionLadder from "./ProgressionLadder";
import ProgressionHeader from "./ProgressionHeader";
import { page, topBar, backLink, subtitle, countTag, RungDots } from "../ui";

export const dynamic = "force-dynamic";

export default async function ProgressionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { rename } = await searchParams;
  const [detail, exercises] = await Promise.all([
    getProgressionDetail(id),
    getExerciseOptions(),
  ]);
  if (!detail) notFound();

  return (
    <main style={page}>
      <div style={topBar}>
        <Link href="/progressions" style={backLink}>← Progressions</Link>
        <RungDots total={detail.total} done={detail.done} />
      </div>

      <ProgressionHeader id={detail.id} name={detail.name} autoRename={rename === "1"} />

      <p style={{ ...subtitle, margin: 0 }}>
        {detail.total === 0 ? (
          "Add the steps in order — easiest first, hardest last."
        ) : (
          <span style={countTag}>{detail.done} of {detail.total} done</span>
        )}
      </p>

      <ProgressionLadder
        progressionId={detail.id}
        rungs={detail.rungs}
        currentId={detail.currentId}
        exercises={exercises}
      />
    </main>
  );
}
