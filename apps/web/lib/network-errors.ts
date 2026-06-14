/** Map browser fetch/network failures to user-facing auth messages. */
export function toUserFacingNetworkError(
  err: unknown,
  fallback: string,
): Error {
  if (err instanceof Error) {
    if (err.message === "Failed to fetch" || err.name === "TypeError") {
      return new Error(
        "Server bilan bog'lanib bo'lmadi. API uyqudan uyg'onayotgan bo'lishi mumkin — " +
          "30 soniya kutib qayta urinib ko'ring. Muammo davom etsa, " +
          "https://genetic-contour-platform-web.vercel.app manzilidan foydalaning.",
      );
    }
    return err;
  }
  return new Error(fallback);
}

export function detailFromBody(body: Record<string, unknown>, fallback: string): string {
  const detail = body.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return String(item);
      })
      .join("; ");
  }
  return fallback;
}
