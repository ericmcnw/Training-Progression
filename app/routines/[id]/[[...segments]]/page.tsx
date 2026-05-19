import { notFound } from "next/navigation";
import GuidedTemplatePageContent from "../details/GuidedTemplatePageContent";
import RoutineTemplatePageContent from "../details/RoutineTemplatePageContent";

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

  if (segments.length === 1 && segments[0] === "guided") {
    return <GuidedTemplatePageContent params={{ id }} />;
  }

  if (segments.length === 1 && segments[0] === "template") {
    return <RoutineTemplatePageContent params={{ id }} />;
  }

  notFound();
}
