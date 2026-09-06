import "server-only";

const ALLOWED_APP_PATHS = [
  "/",
  "/challenge",
  "/daily",
  "/discover",
  "/endless",
  "/feed",
  "/impossible",
  "/leaderboard",
  "/play",
  "/pricing",
  "/profile",
  "/rounds",
  "/say-it-back",
  "/settings",
  "/stream",
  "/submit",
  "/u",
  "/d",
] as const;

function allowedPathname(pathname: string): boolean {
  return ALLOWED_APP_PATHS.some(
    (root) => pathname === root || (root !== "/" && pathname.startsWith(`${root}/`)),
  );
}

export function safeInternalAppPath(
  requested: string | null | undefined,
  origin: string,
  fallback = "/profile",
): string {
  if (
    !requested ||
    requested.length > 2_048 ||
    /[\\\u0000-\u001f\u007f]/.test(requested) ||
    /%(?:2f|5c)/i.test(requested)
  ) {
    return fallback;
  }
  try {
    const trustedOrigin = new URL(origin).origin;
    const resolved = new URL(requested, trustedOrigin);
    if (resolved.origin !== trustedOrigin || !allowedPathname(resolved.pathname)) {
      return fallback;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
