import GoalDetailPage from "@/app/goals/details/GoalDetailPage";

// Canonical goal-detail route. Lives under /plan/goals/<id> so links from
// Home's HabitGrid and Plan's Goals tab share one destination. The old
// /goals/<id> URL redirects here (see app/goals/[[...segments]]/page.tsx).
//
// Initial implementation just delegates to the existing GoalDetailPage
// component — Phase B can extend it (longer history, log list, etc.)
// without changing this route.

export const dynamic = "force-dynamic";

type Params = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;

export default async function PlanGoalDetailPage(props: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  return (
    <GoalDetailPage
      params={Promise.resolve({ goalId: params.id })}
      searchParams={Promise.resolve(searchParams)}
    />
  );
}