import { redirect } from "next/navigation";

type Params = { id: string; logId: string };

export default async function LegacyEditRunLogPage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  redirect(`/routines/${params.id}/log-cardio/${params.logId}`);
}
