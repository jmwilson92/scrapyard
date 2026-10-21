/** RFQ / quote attachment rules. Pure so it can be unit tested. */

export const MAX_ATTACHMENT_BYTES = 4_000_000;
/** Server action bodies are capped at 4 MB (Vercel functions at 4.5 MB). */
export const MAX_ATTACHMENTS_TOTAL_BYTES = 4_000_000;
export const MAX_RFQ_ATTACHMENTS = 5;
export const MAX_QUOTE_ATTACHMENTS = 2;

export const ATTACHMENT_TYPES: Record<string, { label: string; contentType: string }> = {
  pdf: { label: "PDF", contentType: "application/pdf" },
  png: { label: "PNG image", contentType: "image/png" },
  jpg: { label: "JPEG image", contentType: "image/jpeg" },
  jpeg: { label: "JPEG image", contentType: "image/jpeg" },
  webp: { label: "WebP image", contentType: "image/webp" },
  dxf: { label: "DXF drawing", contentType: "application/dxf" },
  dwg: { label: "DWG drawing", contentType: "application/acad" },
  step: { label: "STEP model", contentType: "application/step" },
  stp: { label: "STEP model", contentType: "application/step" },
  iges: { label: "IGES model", contentType: "model/iges" },
  igs: { label: "IGES model", contentType: "model/iges" },
  stl: { label: "STL model", contentType: "model/stl" },
  txt: { label: "Text", contentType: "text/plain" },
  csv: { label: "CSV", contentType: "text/csv" },
  xlsx: {
    label: "Excel",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  docx: {
    label: "Word",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

export const ATTACHMENT_HELP =
  "PDF, images, DXF/DWG, STEP/IGES/STL, TXT/CSV, XLSX/DOCX. Up to 4 MB per file and 4 MB per submission.";

export type CheckedAttachment = {
  name: string;
  ext: string;
  contentType: string;
  size: number;
};

export function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/^\.+/, "")
    .slice(-100);
  return cleaned || "file";
}

export function fileExtension(name: string): string {
  const match = /\.([a-z0-9]{2,5})$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Checks one file's name, size, and (for formats with a signature) its first
 * bytes, so a renamed executable can't pass as a PDF or image.
 */
export function checkAttachment(
  name: string,
  size: number,
  head: Uint8Array,
): { ok: true; value: CheckedAttachment } | { ok: false; error: string } {
  const clean = safeFileName(name);
  const ext = fileExtension(clean);
  const type = ATTACHMENT_TYPES[ext];
  if (!type) return { ok: false, error: `${clean}: that file type isn't allowed.` };
  if (size <= 0) return { ok: false, error: `${clean} is empty.` };
  if (size > MAX_ATTACHMENT_BYTES) return { ok: false, error: `${clean} is over 4 MB.` };
  if (!signatureMatches(ext, head)) {
    return { ok: false, error: `${clean} doesn't look like a real ${type.label} file.` };
  }
  return { ok: true, value: { name: clean, ext, contentType: type.contentType, size } };
}

export function checkAttachmentSet(
  files: readonly { name: string; size: number; head: Uint8Array }[],
  max: number,
): { ok: true; value: CheckedAttachment[] } | { ok: false; error: string } {
  if (files.length > max) return { ok: false, error: `Attach up to ${max} files.` };
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_ATTACHMENTS_TOTAL_BYTES) {
    return { ok: false, error: "Attachments add up to more than 4 MB. Send fewer or smaller files." };
  }
  const checked: CheckedAttachment[] = [];
  for (const file of files) {
    const result = checkAttachment(file.name, file.size, file.head);
    if (!result.ok) return result;
    checked.push(result.value);
  }
  return { ok: true, value: checked };
}

function starts(head: Uint8Array, bytes: number[]): boolean {
  return bytes.every((byte, index) => head[index] === byte);
}

function signatureMatches(ext: string, head: Uint8Array): boolean {
  switch (ext) {
    case "pdf":
      return starts(head, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case "png":
      return starts(head, [0x89, 0x50, 0x4e, 0x47]);
    case "jpg":
    case "jpeg":
      return starts(head, [0xff, 0xd8, 0xff]);
    case "webp":
      return starts(head, [0x52, 0x49, 0x46, 0x46]) && starts(head.slice(8), [0x57, 0x45, 0x42, 0x50]);
    case "xlsx":
    case "docx":
      return starts(head, [0x50, 0x4b, 0x03, 0x04]); // zip container
    case "dwg":
      return starts(head, [0x41, 0x43]); // "AC" version header
    default:
      // Text-ish CAD/data formats: reject obvious binaries/executables.
      return !looksExecutable(head);
  }
}

function looksExecutable(head: Uint8Array): boolean {
  return (
    starts(head, [0x4d, 0x5a]) || // MZ (Windows)
    starts(head, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
    starts(head, [0xcf, 0xfa, 0xed, 0xfe]) || // Mach-O
    starts(head, [0x23, 0x21]) // #! script
  );
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
