import { NextResponse } from "next/server";
import { getLogEditData } from "@/lib/log-edit-data";

export const dynamic = "force-dynamic";

// JSON sibling of the edit page's data fetcher. Used by the drawer-mounted
// edit flow so opening Edit on a logged routine swaps the view drawer for
// an edit drawer in place (instead of navigating to the full page).
//
// Dates serialize to ISO strings via NextResponse.json — the drawer hydrates
// them back to Date instances before mounting each EditXxxForm, which still
// expects Date for `initialPerformedAt`.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ logId: string }> }
) {
  const { logId } = await params;
  if (!logId) return NextResponse.json({ error: "Missing logId" }, { status: 400 });

  const data = await getLogEditData(logId);
  if (!data) return NextResponse.json({ error: "Log not found" }, { status: 404 });

  return NextResponse.json(data);
}
