export const AUTH_MODE_VALUES = ["single-user-dev", "authenticated"] as const;

export type AuthMode = (typeof AUTH_MODE_VALUES)[number];

export const AUTH_SESSION_COOKIE = "progression_session";
export const AUTH_USER_ID_COOKIE = "progression_user_id";
export const AUTH_PUBLIC_PATHS = ["/signin"] as const;
export const DEV_ONLY_PATH_PREFIXES = ["/_dev"] as const;

const INTERNAL_PATH_PREFIXES = ["/_next", "/favicon.ico"] as const;
const PUBLIC_FILE_PATTERN = /\.[a-z0-9]+$/i;

export function normalizeAuthMode(value: string | undefined | null): AuthMode {
  return value === "authenticated" ? "authenticated" : "single-user-dev";
}

export function authModeFromEnv(envValue: string | undefined | null = process.env.PROGRESSION_AUTH_MODE): AuthMode {
  return normalizeAuthMode(envValue);
}

export function isPublicAssetPath(pathname: string) {
  return PUBLIC_FILE_PATTERN.test(pathname);
}

export function isInternalPath(pathname: string) {
  return INTERNAL_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAuthPublicPath(pathname: string) {
  return AUTH_PUBLIC_PATHS.some((publicPath) => pathname === publicPath || pathname.startsWith(`${publicPath}/`));
}

export function isDevOnlyPath(pathname: string) {
  return DEV_ONLY_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedAppPath(pathname: string) {
  if (!pathname.startsWith("/")) return false;
  if (isInternalPath(pathname) || isPublicAssetPath(pathname) || isAuthPublicPath(pathname)) return false;
  return !isDevOnlyPath(pathname);
}

export function buildAuthRedirectTarget(pathname: string, search = "") {
  const next = `${pathname}${search}`;
  return `/signin?next=${encodeURIComponent(next)}`;
}
