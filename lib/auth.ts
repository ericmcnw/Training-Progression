import { authModeFromEnv, isEmailAllowed, type AuthMode } from "@/lib/auth-paths";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type AppSession = {
  userId: string | null;
  profileKey: string;
  isAuthenticated: boolean;
  mode: AuthMode;
};

// Owned data is still keyed to the single "default" profile; signed-in users
// share it until per-user ownership lands, which is why sign-in is allowlisted.
const SHARED_PROFILE_KEY = "default";

function singleUserSession(): AppSession {
  return {
    userId: null,
    profileKey: SHARED_PROFILE_KEY,
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

export async function getAppSession(): Promise<AppSession> {
  if (getConfiguredAuthMode() !== "authenticated") {
    return singleUserSession();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user?.id || !isEmailAllowed(user.email)) {
    return anonymousSession();
  }

  return {
    userId: user.id,
    profileKey: SHARED_PROFILE_KEY,
    isAuthenticated: true,
    mode: "authenticated",
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
