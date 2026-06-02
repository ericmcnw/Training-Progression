import { notFound } from "next/navigation";
import GuidedTemplatePageContent from "../details/GuidedTemplatePageContent";
import RoutineTemplatePageContent from "../details/RoutineTemplatePageContent";
import RoutineDetailPage from "../details/RoutineDetailPage";

export const dynamic = "force-dynamic";

type Params = {
  id: string;
  segments?: string[];
};

export default async function RoutineSubpage(props: {
  params: Promise<Params>;
}) {
  const params = await props.params;
  const { id, segments = [] } = params;

  // Bare /routines/[id] — no extra segments. Renders the routine detail
  // page (header + cadence + per-exercise charts + recent sessions +
  // frequency-goal contributions). Can't live in a sibling page.tsx
  // because the [[...segments]] catch-all is optional and matches the
  // bare path too, which would conflict with a same-level page.tsx.
  if (segments.length === 0) {
    return <RoutineDetailPage id={id} />;
  }

  if (segments.length === 1 && segments[0] === "guided") {
    return <GuidedTemplatePageContent params={{ id }} />;
  }

  if (segments.length === 1 && segments[0] === "template") {
    return <RoutineTemplatePageContent params={{ id }} />;
  }

  notFound();
}
