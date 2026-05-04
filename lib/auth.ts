import { cookies } from "next/headers";
import { AUTH_SESSION_COOKIE, AUTH_USER_ID_COOKIE, authModeFromEnv, type AuthMode } from "@/lib/auth-paths";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type AppSession = {
  userId: string | null;
  profileKey: string;
  isAuthenticated: boolean;
  mode: AuthMode;
};

function userProfileKey(userId: string) {
  return `user:${userId}`;
}

function singleUserSession(): AppSession {
  return {
    userId: null,
    profileKey: "default",
    isAuthenticated: false,
    mode: "single-user-dev",
  };
}

function authenticatedSession(userId: string): AppSession {
  return {
    userId,
    profileKey: userProfileKey(userId),
    isAuthenticated: true,
    mode: "authenticated",
  };
}

export function getConfiguredAuthMode() {
  return authModeFromEnv();
}

export async function getAppSession(): Promise<AppSession> {
  const authMode = getConfiguredAuthMode();

  // Central seam for future auth integration. Until a provider is installed,
  // the app keeps running in single-user mode by default.
  if (authMode !== "authenticated") {
    return singleUserSession();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (!error && data.user?.id) {
      return authenticatedSession(data.user.id);
    }
  } catch {
    // Fall through to the cookie-based placeholder so local setup can still
    // boot before Supabase keys are configured.
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_SESSION_COOKIE)?.value?.trim();
  const userIdCookie = cookieStore.get(AUTH_USER_ID_COOKIE)?.value?.trim();
  const userId = userIdCookie || sessionCookie || "";

  if (!userId) {
    return {
      userId: null,
      profileKey: "anonymous",
      isAuthenticated: false,
      mode: "authenticated",
    };
  }

  return authenticatedSession(userId);
}

export async function requireAuthenticatedUser() {
  const session = await getAppSession();
  if (!session.userId) {
    throw new Error("Authentication is not configured yet.");
  }
  return session;
}

export function scopeOwnedWhere<TWhere extends Record<string, unknown>>(where: TWhere, userId: string | null) {
  return userId ? { ...where, userId } : where;
}

export async function routineAccessWhere(id: string) {
  const session = await getAppSession();

  return scopeOwnedWhere({ id }, session.userId);
}
