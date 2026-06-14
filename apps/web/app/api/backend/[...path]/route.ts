import { NextRequest, NextResponse } from "next/server";

import {
  bffNetworkErrorDetail,
  fetchBackend,
  getBackendApiBase,
  parseBackendJson,
} from "@/lib/bff-backend";
import { buildProxyResponse } from "@/lib/bff-proxy-response";

export const maxDuration = 60;

async function proxyRequest(request: NextRequest, path: string) {
  const accessToken = request.cookies.get("gc_access_token")?.value;
  const refreshToken = request.cookies.get("gc_refresh_token")?.value;

  const headers: Record<string, string> = {};
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const apiBase = getBackendApiBase();
  const url = `${apiBase}/api/${path}${request.nextUrl.search}`;
  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (contentType?.includes("multipart/form-data")) {
      body = await request.formData();
      delete headers["Content-Type"];
    } else {
      body = await request.text();
    }
  }

  try {
    let res = await fetchBackend(url, { method: request.method, headers, body });

    if (res.status === 401 && refreshToken) {
      const refreshRes = await fetchBackend(`${apiBase}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (refreshRes.ok) {
        const tokens = await parseBackendJson(refreshRes);
        const newAccess = tokens.access_token;
        const newRefresh = tokens.refresh_token;
        if (typeof newAccess === "string") {
          headers.Authorization = `Bearer ${newAccess}`;
        }
        res = await fetchBackend(url, { method: request.method, headers, body });
        const out = await buildProxyResponse(res);
        if (typeof newAccess === "string" && typeof newRefresh === "string") {
          const secure = request.nextUrl.protocol === "https:";
          out.cookies.set("gc_access_token", newAccess, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 30,
          });
          out.cookies.set("gc_refresh_token", newRefresh, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });
        }
        return out;
      }
    }

    return buildProxyResponse(res);
  } catch (err) {
    return NextResponse.json(
      { detail: bffNetworkErrorDetail(err) },
      { status: 503 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path.join("/"));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path.join("/"));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path.join("/"));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path.join("/"));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path.join("/"));
}
