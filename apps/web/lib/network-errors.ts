/** Map browser fetch/network failures to user-facing auth messages. */

const INVALID_CREDENTIALS = new Set([
  "Invalid email or password",
  "Incorrect email or password",
]);

export function mapAuthErrorMessage(message: string): string {
  if (INVALID_CREDENTIALS.has(message.trim())) {
    return "Email yoki parol noto'g'ri";
  }
  return message;
}

function isBrowserNetworkFailure(err: Error): boolean {
  return (
    err.message === "Failed to fetch" ||
    err.name === "AbortError" ||
    (err.name === "TypeError" && err.message === "Failed to fetch")
  );
}

export function toUserFacingNetworkError(
  err: unknown,
  fallback: string,
): Error {
  if (err instanceof Error) {
    if (!isBrowserNetworkFailure(err)) {
      return new Error(mapAuthErrorMessage(err.message || fallback));
    }
    return new Error(
      "Server bilan bog'lanib bo'lmadi. API uyqudan uyg'onayotgan bo'lishi mumkin — " +
        "30 soniya kutib qayta urinib ko'ring.",
    );
  }
  return new Error(fallback);
}

export function detailFromBody(body: Record<string, unknown>, fallback: string): string {
  const detail = body.detail;
  let message = fallback;
  if (typeof detail === "string" && detail.trim()) {
    message = detail;
  } else if (Array.isArray(detail)) {
    message = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return String(item);
      })
      .join("; ");
  }
  return mapAuthErrorMessage(message);
}
