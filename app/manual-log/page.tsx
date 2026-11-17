import { redirect } from "next/navigation";

export default async function ManualLogRedirect({ searchParams }: { searchParams?: Promise<{ domain?: string }> }) {
  const domain = (await searchParams)?.domain;
  redirect(domain ? `/log?view=history&domain=${encodeURIComponent(domain)}` : "/log?view=history");
}
