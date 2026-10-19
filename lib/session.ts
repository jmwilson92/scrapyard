import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import {
  createSession,
  deleteSession,
  findUserBySession,
} from "@/lib/repo";
import { getRequestDb } from "@/lib/server-db";
import type { PublicUser } from "@/lib/types";

const COOKIE = "dropyard_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const db = await getRequestDb();
  return findUserBySession(db, hashToken(token));
}

export async function startSession(userId: string): Promise<void> {
  const db = await getRequestDb();
  const token = randomBytes(32).toString("hex");
  await createSession(db, {
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getRequestDb();
    await deleteSession(db, hashToken(token));
  }
  jar.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
