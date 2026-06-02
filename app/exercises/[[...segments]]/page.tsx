import { notFound } from "next/navigation";
import EditExercisePage from "../details/EditExercisePage";
import ExerciseDetailPage from "../details/ExerciseDetailPage";
import ExercisesPageContent from "../ExercisesPageContent";

export const dynamic = "force-dynamic";

type Params = { segments?: string[] };

// URL contract:
//   /exercises                     → library (browse + create)
//   /exercises/<id>                → exercise detail page (data + charts)
//   /exercises/<id>/edit           → edit form
// Pre-2026-06-02 the 1-segment case routed to the edit form, which
// meant tapping an exercise card on the strength dashboard dumped the
// user onto an edit form they didn't ask for. Detail is the natural
// landing now; edit moves behind /edit.
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
    return <ExerciseDetailPage id={segments[0]} />;
  }

  if (segments.length === 2 && segments[1] === "edit") {
    return <EditExercisePage params={{ id: segments[0] }} />;
  }

  notFound();
}
