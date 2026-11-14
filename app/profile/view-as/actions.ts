"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth";
import { basePrisma } from "@/lib/prisma-base";
import { VIEW_AS_COOKIE } from "@/lib/auth-paths";

export async function startViewingAs(formData: FormData) {
  const session = await getAppSession();
  if (!session.isAdmin) throw new Error("Only admins can view other accounts.");

  const profileKey = String(formData.get("profileKey") ?? "");
  const store = await cookies();
  if (!profileKey || profileKey === (session.ownProfileKey ?? session.profileKey)) {
    store.delete(VIEW_AS_COOKIE);
  } else {
    store.set(VIEW_AS_COOKIE, profileKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  }
  redirect("/");
}

export async function stopViewingAs() {
  (await cookies()).delete(VIEW_AS_COOKIE);
  redirect("/");
}

export async function setClient(formData: FormData) {
  const session = await getAppSession();
  if (!session.isAdmin) throw new Error("Only admins can manage clients.");

  const ownProfileKey = session.ownProfileKey ?? session.profileKey;
  const profileKey = String(formData.get("profileKey") ?? "");
  if (!profileKey || profileKey === ownProfileKey) return;
  await basePrisma.appProfile.update({
    where: { key: profileKey },
    data: { managedByKey: formData.get("client") === "on" ? ownProfileKey : null },
  });
  revalidatePath("/profile/view-as");
  revalidatePath("/");
}
