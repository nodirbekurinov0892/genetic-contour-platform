import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_SESSION_COOKIE } from "@/lib/auth-storage";

const PROTECTED_PREFIXES = ["/upload", "/experiments", "/reports"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get(AUTH_SESSION_COOKIE)?.value === "1";
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/upload",
    "/upload/:path*",
    "/experiments",
    "/experiments/:path*",
    "/reports",
    "/reports/:path*",
  ],
};
