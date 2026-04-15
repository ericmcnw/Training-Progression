import { notFound } from "next/navigation";
import GoalDetailPage from "../details/GoalDetailPage";
import GoalsPageContent from "../GoalsPageContent";

export const dynamic = "force-dynamic";

type Params = { segments?: string[] };
type SearchParams = Record<string, string | string[] | undefined>;

export default async function GoalsPage(props: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const segments = params.segments ?? [];

  if (segments.length === 0) {
    return <GoalsPageContent searchParams={searchParams} />;
  }

  if (segments.length === 1) {
    return <GoalDetailPage params={{ goalId: segments[0] }} searchParams={searchParams} />;
  }

  notFound();
}
