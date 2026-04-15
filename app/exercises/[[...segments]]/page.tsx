import { notFound } from "next/navigation";
import EditExercisePage from "../details/EditExercisePage";
import ExercisesPageContent from "../ExercisesPageContent";

export const dynamic = "force-dynamic";

type Params = { segments?: string[] };

export default async function ExercisesPage(props: {
  params: Promise<Params>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const segments = params.segments ?? [];

  if (segments.length === 0) {
    return <ExercisesPageContent searchParams={searchParams} />;
  }

  if (segments.length === 1) {
    return <EditExercisePage params={{ id: segments[0] }} />;
  }

  notFound();
}
