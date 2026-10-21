import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Private file storage for RFQ/quote attachments (and photos on a private
 * Blob store). Files are addressed by a pathname like `rfq/<uuid>/<name>` and
 * are only ever served back through an app route that checks the session.
 *
 * - Vercel Blob when BLOB_READ_WRITE_TOKEN is set (store access: BLOB_ACCESS,
 *   default "private").
 * - Local disk under data/files otherwise (dev/tests only; Vercel's disk is
 *   read-only and not shared, so uploads are refused there without Blob).
 */

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function blobAccess(): "public" | "private" {
  return (process.env.BLOB_ACCESS || "").toLowerCase() === "public" ? "public" : "private";
}

export function filesUnavailableReason(): string | null {
  if (blobConfigured()) return null;
  if (process.env.VERCEL) {
    return "File uploads need Vercel Blob storage. Ask the site admin to connect a Blob store (BLOB_READ_WRITE_TOKEN).";
  }
  return null;
}

export async function putPrivateFile(
  pathname: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  assertSafePathname(pathname);
  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    await put(pathname, Buffer.from(bytes), {
      access: blobAccess(),
      contentType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return;
  }
  const file = localPath(pathname);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
}

export async function readPrivateFile(
  pathname: string,
): Promise<{ body: ReadableStream<Uint8Array> | Uint8Array; contentType: string | null } | null> {
  assertSafePathname(pathname);
  if (blobConfigured()) {
    const { get } = await import("@vercel/blob");
    const result = await get(pathname, {
      access: blobAccess(),
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return { body: result.stream, contentType: result.blob.contentType };
  }
  try {
    return { body: new Uint8Array(await fs.readFile(localPath(pathname))), contentType: null };
  } catch {
    return null;
  }
}

export async function deletePrivateFile(pathname: string): Promise<void> {
  try {
    assertSafePathname(pathname);
    if (blobConfigured()) {
      const { del } = await import("@vercel/blob");
      await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return;
    }
    await fs.unlink(localPath(pathname));
  } catch {
    // Already gone; a leftover file can be cleaned up later.
  }
}

function localPath(pathname: string): string {
  return path.join(process.cwd(), "data", "files", ...pathname.split("/"));
}

function assertSafePathname(pathname: string): void {
  if (!/^[a-z]+(\/[\w.-]+)+$/.test(pathname) || pathname.includes("..")) {
    throw new Error("Unsafe file path");
  }
}
