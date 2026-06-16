import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_SESSION_COOKIE } from "@/lib/auth-storage";

const PROTECTED_PREFIXES = [
  "/",
  "/upload",
  "/library",
  "/ground-truth",
  "/benchmarks",
  "/experiments",
  "/comparison",
  "/analytics",
  "/reports",
  "/notifications",
  "/storage",
  "/search",
  "/api-explorer",
  "/team",
  "/help",
  "/profile",
  "/onboarding",
];

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PROTECTED_PREFIXES.some(
    (prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`)),
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
    "/",
    "/upload",
    "/upload/:path*",
    "/library",
    "/library/:path*",
    "/ground-truth",
    "/ground-truth/:path*",
    "/benchmarks",
    "/benchmarks/:path*",
    "/experiments",
    "/experiments/:path*",
    "/comparison",
    "/comparison/:path*",
    "/analytics",
    "/analytics/:path*",
    "/reports",
    "/reports/:path*",
    "/notifications",
    "/notifications/:path*",
    "/storage",
    "/storage/:path*",
    "/search",
    "/search/:path*",
    "/api-explorer",
    "/api-explorer/:path*",
    "/team",
    "/team/:path*",
    "/help",
    "/help/:path*",
    "/profile",
    "/profile/:path*",
    "/onboarding",
    "/onboarding/:path*",
  ],
};
