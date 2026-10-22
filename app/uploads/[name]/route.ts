import { connection } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { blobConfigured, readPrivateFile } from "@/lib/file-store";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  await connection();
  const { name } = await context.params;
  if (!/^[\w.-]+$/.test(name) || name.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const extension = path.extname(name).toLowerCase();
  const type = TYPES[extension];
  if (!type) return new Response("Not found", { status: 404 });

  if (blobConfigured()) {
    const stored = await readPrivateFile(`listings/${name}`).catch(() => null);
    if (!stored) return new Response("Not found", { status: 404 });
    return new Response(stored.body as BodyInit, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const file = path.join(process.cwd(), "data", "uploads", name);
  try {
    const bytes = await fs.readFile(file);
    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
