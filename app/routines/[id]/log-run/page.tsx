import { redirect } from "next/navigation";

type Params = { id: string };

export default async function LegacyLogRunPage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  redirect(`/routines/${params.id}/log-cardio`);
}
