/**
 * Prevent open redirects after login (blocks //evil.com, https://..., etc.).
 */
export function safeRedirectPath(path: string | null | undefined): string {
  if (!path) return "/";

  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }

  if (trimmed.includes("://") || trimmed.includes("\\")) {
    return "/";
  }

  return trimmed;
}
