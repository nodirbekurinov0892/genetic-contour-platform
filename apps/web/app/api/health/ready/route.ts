import { NextResponse } from "next/server";

import { fetchBackend, getBackendApiBase, parseBackendJson } from "@/lib/bff-backend";

export async function GET() {
  try {
    const res = await fetchBackend(`${getBackendApiBase()}/health/ready`);
    const data = await parseBackendJson(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", service: "contour-analytics-api" }, { status: 503 });
  }
}
