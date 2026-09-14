import { notFound } from "next/navigation";
import EditRoutineLogPage from "../details/EditRoutineLogPage";
import RoutineLogDetailPage from "../details/RoutineLogDetailPage";

export const dynamic = "force-dynamic";

type Params = {
  id: string;
  logId: string;
  segments?: string[];
};
type SearchParams = Record<string, string | string[] | undefined>;

export default async function RoutineLogPage(props: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const { id, logId, segments = [] } = params;

  // Both the bare URL and an explicit /details render the detail page —
  // link sites across the app and two revalidatePath calls target /details.
  if (segments.length === 0 || (segments.length === 1 && segments[0] === "details")) {
    return <RoutineLogDetailPage params={{ id, logId }} searchParams={searchParams} />;
  }

  if (segments.length === 1 && segments[0] === "edit") {
    return <EditRoutineLogPage params={{ id, logId }} searchParams={searchParams} />;
  }

  notFound();
}
