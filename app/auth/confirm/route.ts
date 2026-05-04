import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function normalizeNext(value: string | null) {
  const next = (value ?? "").trim();
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = normalizeNext(searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent("Missing confirmation token.")}`, origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "email" | "recovery" | "invite" | "email_change",
  });

  if (error) {
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(error.message)}`, origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
