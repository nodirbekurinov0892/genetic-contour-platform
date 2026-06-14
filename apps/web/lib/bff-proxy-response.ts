import { NextResponse } from "next/server";

const STRIP_HEADERS = new Set([
  "content-encoding",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "content-length",
  "content-md5",
]);

const ALLOW_HEADERS = new Set([
  "content-type",
  "content-disposition",
  "cache-control",
  "etag",
  "last-modified",
  "x-request-id",
]);

/** Build a client-safe proxy response without broken content-encoding headers. */
export async function buildProxyResponse(res: Response): Promise<NextResponse> {
  const body = await res.arrayBuffer();
  const headers = new Headers();

  res.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (STRIP_HEADERS.has(lower)) return;
    if (lower.startsWith("access-control-")) return;
    if (ALLOW_HEADERS.has(lower)) {
      headers.set(key, value);
    }
  });

  if (!headers.has("Content-Type") && res.headers.get("content-type")) {
    headers.set("Content-Type", res.headers.get("content-type")!);
  }

  return new NextResponse(body, { status: res.status, headers });
}
