import fs from "node:fs";
import path from "node:path";
import type { LatLng } from "@/lib/geo";

export type ZipRecord = LatLng & {
  city: string;
  state: string;
};

let cached: Map<string, ZipRecord> | null = null;

export function normalizeZip(input: string): string {
  return input.replace(/\D/g, "").slice(0, 5);
}

export function parseZipCsv(text: string): Map<string, ZipRecord> {
  const map = new Map<string, ZipRecord>();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("zip,")) continue;
    const parts = splitCsvLine(line);
    if (parts.length < 5) continue;
    const [zip, latRaw, lngRaw, city, state] = parts;
    if (!/^\d{5}$/.test(zip)) continue;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    map.set(zip, { lat, lng, city, state });
  }
  return map;
}

export function getZipIndex(): Map<string, ZipRecord> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "zip-centroids.csv");
  cached = parseZipCsv(fs.readFileSync(file, "utf8"));
  return cached;
}

export function lookupZip(zip: string): ZipRecord | null {
  const normalized = normalizeZip(zip);
  if (normalized.length !== 5) return null;
  return getZipIndex().get(normalized) ?? null;
}

function splitCsvLine(line: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}
