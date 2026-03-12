import { redirect } from "next/navigation";

type Params = { exerciseId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function LegacyExerciseProgressPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const tab = getParam(searchParams, "tab") ?? "overview";
  const range = getParam(searchParams, "range") ?? "12w";
  redirect(`/progress/exercises/${params.exerciseId}?tab=${tab}&range=${range}`);
}
