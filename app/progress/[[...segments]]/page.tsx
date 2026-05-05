import { notFound } from "next/navigation";
import CardioTargetPage from "../details/CardioTargetPage";
import ExerciseTargetPage from "../details/ExerciseTargetPage";
import GroupTargetPage from "../details/GroupTargetPage";
import RoutineTargetPage from "../details/RoutineTargetPage";
import SportsTargetPage from "../details/SportsTargetPage";
import ProgressOverviewContent from "../ProgressOverviewContent";
import InjuriesIndexView from "../InjuriesIndexView";

export const dynamic = "force-dynamic";

type Params = { segments?: string[] };
type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProgressPage(props: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const segments = params.segments ?? [];

  if (segments.length === 0) {
    return <ProgressOverviewContent searchParams={searchParams} />;
  }

  if (segments.length === 1) {
    const section = segments[0];
    if (section === "injuries") {
      return <InjuriesIndexView />;
    }
    if (!["routines", "exercises", "groups", "cardio", "sports"].includes(section)) {
      notFound();
    }
    return <ProgressOverviewContent searchParams={{ ...searchParams, section }} />;
  }

  if (segments.length === 2) {
    const [section, targetId] = segments;
    if (section === "routines") {
      return <RoutineTargetPage params={{ routineId: targetId }} searchParams={searchParams} />;
    }
    if (section === "exercises") {
      return <ExerciseTargetPage params={{ exerciseId: targetId }} searchParams={searchParams} />;
    }
    if (section === "groups") {
      return <GroupTargetPage params={{ slug: targetId }} searchParams={searchParams} />;
    }
    if (section === "cardio") {
      return <CardioTargetPage params={{ slug: targetId }} searchParams={searchParams} />;
    }
    if (section === "sports") {
      return <SportsTargetPage params={{ slug: targetId }} searchParams={searchParams} />;
    }
  }

  notFound();
}
