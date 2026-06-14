import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function proxyRequest(request: NextRequest, path: string) {
  const accessToken = request.cookies.get("gc_access_token")?.value;
  const refreshToken = request.cookies.get("gc_refresh_token")?.value;

  const headers: Record<string, string> = {};
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const url = `${API_BASE}/api/${path}${request.nextUrl.search}`;
  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (contentType?.includes("multipart/form-data")) {
      body = await request.formData();
      delete headers["Content-Type"];
    } else {
      body = await request.text();
    }
  }

  let res = await fetch(url, { method: request.method, headers, body });

  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (refreshRes.ok) {
      const tokens = await refreshRes.json();
      headers.Authorization = `Bearer ${tokens.access_token}`;
      res = await fetch(url, { method: request.method, headers, body });
      const secure = request.nextUrl.protocol === "https:";
      const out = new NextResponse(res.body, { status: res.status, headers: res.headers });
      out.cookies.set("gc_access_token", tokens.access_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 30,
      });
      out.cookies.set("gc_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return out;
    }
  }

  return new NextResponse(res.body, { status: res.status, headers: res.headers });
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
