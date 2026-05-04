"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function normalizeNext(next: string | null) {
  const value = (next ?? "").trim();
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = normalizeNext(String(formData.get("next") ?? ""));

  if (!email) {
    redirect(`/signin?error=${encodeURIComponent("Email is required.")}&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const origin = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    redirect(`/signin?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }

  redirect(`/signin?message=${encodeURIComponent("Check your email for the sign-in link.")}&next=${encodeURIComponent(next)}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin?message=Signed%20out");
}
