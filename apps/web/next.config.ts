import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const storagePublicUrl = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL || "";

if (process.env.NODE_ENV === "production" && !storagePublicUrl) {
  console.warn(
    "[next.config] NEXT_PUBLIC_STORAGE_PUBLIC_URL is not set. " +
      "R2/S3 result images will be blocked by next/image unless API serves /static URLs.",
  );
}

function patternFromBaseUrl(
  baseUrl: string,
  pathname: string,
): { protocol: "http" | "https"; hostname: string; port?: string; pathname: string } | null {
  try {
    const parsed = new URL(baseUrl);
    return {
      protocol: parsed.protocol.replace(":", "") as "http" | "https",
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      pathname,
    };
  } catch {
    return null;
  }
}

function buildRemotePatterns() {
  const patterns: Array<{
    protocol: "http" | "https";
    hostname: string;
    port?: string;
    pathname: string;
  }> = [];

  const apiPattern = patternFromBaseUrl(apiUrl, "/static/**");
  if (apiPattern) {
    patterns.push(apiPattern);
  } else {
    patterns.push({
      protocol: "http",
      hostname: "localhost",
      port: "8000",
      pathname: "/static/**",
    });
  }

  // Required in production when API uses STORAGE_BACKEND=s3 (Cloudflare R2 pub-*.r2.dev, etc.)
  const storagePattern = patternFromBaseUrl(storagePublicUrl, "/**");
  if (storagePattern) {
    patterns.push(storagePattern);
  }

  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: buildRemotePatterns(),
  },
};

export default nextConfig;
