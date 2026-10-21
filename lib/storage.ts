import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { blobAccess, blobConfigured, deletePrivateFile, putPrivateFile } from "@/lib/file-store";
import { contentTypeFor, detectImage, MAX_PHOTO_BYTES } from "@/lib/images";

export async function saveListingPhoto(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "That photo was empty." };
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Photos need to be 3.5 MB or smaller." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImage(bytes);
  if (!kind) {
    return { ok: false, error: "Use a JPEG, PNG, or WebP photo." };
  }

  if (process.env.VERCEL && storageProvider() === "local") {
    return {
      ok: false,
      error:
        "Photo uploads on Vercel need Blob storage. Set STORAGE_PROVIDER=blob and BLOB_READ_WRITE_TOKEN, or publish the listing without a photo.",
    };
  }

  try {
    if (storageProvider() === "blob") {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) {
        return {
          ok: false,
          error:
            "STORAGE_PROVIDER is blob, but BLOB_READ_WRITE_TOKEN is not set.",
        };
      }
      const name = `${crypto.randomUUID()}.${kind}`;
      if (blobAccess() === "private") {
        // Private store: keep the bytes in Blob and serve them via /uploads/[name].
        await putPrivateFile(`listings/${name}`, bytes, contentTypeFor(kind));
        return { ok: true, url: `/uploads/${name}` };
      }
      const { put } = await import("@vercel/blob");
      const blob = await put(`listings/${name}`, Buffer.from(bytes), {
        access: "public",
        contentType: contentTypeFor(kind),
        token,
      });
      return { ok: true, url: blob.url };
    }

    const name = `${crypto.randomUUID()}.${kind}`;
    const directory = uploadDirectory();
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, name), bytes);
    return { ok: true, url: `/uploads/${name}` };
  } catch {
    return {
      ok: false,
      error: "The photo couldn't be stored. Try again, or list it without a photo.",
    };
  }
}

export async function deleteStoredPhoto(url: string | null): Promise<void> {
  if (!url || url.startsWith("/seed/")) return;
  if (url.startsWith("/uploads/")) {
    const name = url.slice("/uploads/".length);
    if (!/^[\w.-]+$/.test(name)) return;
    if (blobConfigured()) {
      await deletePrivateFile(`listings/${name}`);
      return;
    }
    await fs.unlink(path.join(uploadDirectory(), name)).catch(() => undefined);
    return;
  }
  if (url.startsWith("http")) {
    try {
      const { del } = await import("@vercel/blob");
      await del(url);
    } catch {
      // The listing is already gone. A leftover blob can be cleaned up later.
    }
  }
}

function storageProvider(): "local" | "blob" {
  const configured = (process.env.STORAGE_PROVIDER || "").toLowerCase();
  if (configured === "blob") return "blob";
  if (configured === "local") return "local";
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

function uploadDirectory(): string {
  return path.join(process.cwd(), "data", "uploads");
}
