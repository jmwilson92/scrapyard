import "server-only";
import { connection } from "next/server";
import type { Client } from "@libsql/client";
import { DatabaseConfigError, getDatabase } from "@/lib/db";

export async function getRequestDb(): Promise<Client> {
  await connection();
  return getDatabase();
}

export async function loadRequestDb(): Promise<
  | { db: Client; error: null }
  | { db: null; error: DatabaseConfigError }
> {
  try {
    return { db: await getRequestDb(), error: null };
  } catch (error) {
    if (error instanceof DatabaseConfigError) return { db: null, error };
    throw error;
  }
}

export function isDatabaseConfigError(
  error: unknown,
): error is DatabaseConfigError {
  return error instanceof DatabaseConfigError;
}
