import { NextRequest, NextResponse } from "next/server";

import {
  bffNetworkErrorDetail,
  fetchBackend,
  parseBackendJson,
} from "@/lib/bff-backend";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetchBackend("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseBackendJson(res);
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
      return NextResponse.json(
        { detail: "Backend token javobi noto'g'ri formatda" },
        { status: 502 },
      );
    }

    const secure = request.nextUrl.protocol === "https:";
    const response = NextResponse.json({ ok: true });
    response.cookies.set("gc_access_token", accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 30,
    });
    response.cookies.set("gc_refresh_token", refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.set("gc_session", "1", {
      httpOnly: false,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { detail: bffNetworkErrorDetail(err) },
      { status: 503 },
    );
  }
}
