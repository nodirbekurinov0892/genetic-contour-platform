import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  for (const name of ["gc_access_token", "gc_refresh_token", "gc_session"]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}
