import { cookies } from "next/headers";
import { cache } from "react";
import { authModeFromEnv, isAdminEmail, isEmailAllowed, VIEW_AS_COOKIE, type AuthMode } from "@/lib/auth-paths";
import { SYNTHETIC_ENDURANCE_ROUTINE_ID } from "@/lib/activity-types";
import { basePrisma as prisma } from "@/lib/prisma-base";
import { physicalSyntheticId } from "@/lib/profile-scope";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type AppSession = {
  userId: string | null;
  profileKey: string;
  isAuthenticated: boolean;
  mode: AuthMode;
  isAdmin?: boolean;
  // Set while an admin is viewing someone else's profile; profileKey is then theirs.
  ownProfileKey?: string;
};

const DEFAULT_PROFILE_KEY = "default";

function singleUserSession(): AppSession {
  return {
    userId: null,
    profileKey: DEFAULT_PROFILE_KEY,
    isAuthenticated: false,
    mode: "single-user-dev",
  };
}

function anonymousSession(): AppSession {
  return {
    userId: null,
    profileKey: "anonymous",
    isAuthenticated: false,
    mode: "authenticated",
  };
}

export function getConfiguredAuthMode() {
  return authModeFromEnv();
}

// A profile claimed by email (seeded with scripts/link-profile.mjs) is linked to
// the Supabase user on first sign-in; anyone else gets a fresh profile.
const profileKeyByAuthUser = new Map<string, string>();

async function resolveProfileKey(authUserId: string, email: string) {
  const known = profileKeyByAuthUser.get(authUserId);
  if (known) return known;
  const key = await lookupProfileKey(authUserId, email);
  profileKeyByAuthUser.set(authUserId, key);
  return key;
}

async function lookupProfileKey(authUserId: string, email: string) {
  const linked = await prisma.appProfile.findUnique({ where: { authUserId }, select: { key: true } });
  if (linked) return linked.key;

  const claimed = await prisma.appProfile.findUnique({ where: { email }, select: { id: true, key: true } });
  if (claimed) {
    await prisma.appProfile.update({ where: { id: claimed.id }, data: { authUserId } });
    return claimed.key;
  }

  const key = `user:${authUserId}`;
  await prisma.$transaction([
    prisma.appProfile.create({ data: { key, email, authUserId } }),
    // Endurance logs need their placeholder routine to exist up front; sport
    // placeholders are created on demand by ensureSportSelected.
    prisma.routine.create({
      data: {
        id: physicalSyntheticId(SYNTHETIC_ENDURANCE_ROUTINE_ID, key),
        profileKey: key,
        name: "Endurance",
        domain: "cardio",
        kind: "CARDIO",
        isActive: true,
        isPlaceholder: true,
        isDeleted: false,
      },
    }),
  ]);
  return key;
}

// The scoped Prisma client asks for the session on every query. React cache
// only dedupes inside a render, so server actions and route handlers are
// memoized on the request's cookie store instead.
const sessionByRequest = new WeakMap<object, Promise<AppSession>>();

export const getAppSession = cache(async (): Promise<AppSession> => {
  if (getConfiguredAuthMode() !== "authenticated") {
    return singleUserSession();
  }

  const store = await cookies();
  let session = sessionByRequest.get(store);
  if (!session) {
    session = resolveSession();
    sessionByRequest.set(store, session);
  }
  return session;
});

async function resolveSession(): Promise<AppSession> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const email = typeof data?.claims.email === "string" ? data.claims.email.toLowerCase() : null;

  if (error || !userId || !email || !isEmailAllowed(email)) {
    return anonymousSession();
  }

  const ownProfileKey = await resolveProfileKey(userId, email);
  const isAdmin = isAdminEmail(email);
  const viewAs = isAdmin ? (await cookies()).get(VIEW_AS_COOKIE)?.value : undefined;
  const viewedProfile =
    viewAs && viewAs !== ownProfileKey
      ? await prisma.appProfile.findUnique({ where: { key: viewAs }, select: { key: true } })
      : null;

  return {
    userId,
    profileKey: viewedProfile?.key ?? ownProfileKey,
    isAuthenticated: true,
    mode: "authenticated",
    isAdmin,
    ownProfileKey: viewedProfile ? ownProfileKey : undefined,
  };
}

export async function requireAuthenticatedUser() {
  const session = await getAppSession();
  if (!session.userId) {
    throw new Error("Authentication is not configured yet.");
  }
  return session;
}

export async function routineAccessWhere(id: string) {
  return { id };
}
