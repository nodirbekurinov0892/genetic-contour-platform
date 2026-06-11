import { fetchAuthenticatedBlob, resolveStaticUrl } from "@/lib/api";

export async function downloadImage(
  filePath: string,
  url: string | null | undefined,
  filename: string,
): Promise<void> {
  const direct = resolveStaticUrl(filePath, url);
  let objectUrl: string | null = null;

  try {
    if (direct.startsWith("http")) {
      const res = await fetch(direct);
      if (!res.ok) throw new Error("Fetch failed");
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
    } else {
      objectUrl = await fetchAuthenticatedBlob(direct);
    }
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename.replace(/[^\w.\-]+/g, "_");
    a.click();
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
