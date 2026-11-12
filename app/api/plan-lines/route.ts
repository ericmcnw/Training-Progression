import { NextResponse } from "next/server";
import { todayAppYmd } from "@/lib/dates";
import { loadPlansForLog, logPlanLines } from "@/lib/program-plan";

export async function GET(req: Request) {
  const sport = new URL(req.url).searchParams.get("sport")?.trim();
  if (!sport || !/^[a-z0-9-]{1,40}$/.test(sport)) return NextResponse.json({ lines: [] });
  const plans = await loadPlansForLog({ kind: "SPORT", sportSlugs: [sport] }, todayAppYmd());
  return NextResponse.json({ lines: logPlanLines(plans) });
}
