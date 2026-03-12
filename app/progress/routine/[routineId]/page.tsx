import { redirect } from "next/navigation";

type Params = { routineId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function LegacyRoutineProgressPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const tab = getParam(searchParams, "tab") ?? "overview";
  const range = getParam(searchParams, "range") ?? "4w";
  redirect(`/progress/routines/${params.routineId}?tab=${tab}&range=${range}`);
}
