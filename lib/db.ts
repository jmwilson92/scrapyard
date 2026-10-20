import fs from "node:fs";
import path from "node:path";
import { createClient, type Client, type InStatement } from "@libsql/client";
import { canonicalForm, inferMetalType, isMetalType } from "@/lib/constants";
import { seedExampleData } from "@/lib/seed";

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    shop_name TEXT NOT NULL,
    zip TEXT NOT NULL,
    is_example INTEGER NOT NULL DEFAULT 0,
    verified_seller INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    title TEXT NOT NULL,
    material TEXT NOT NULL,
    metal_type TEXT NOT NULL DEFAULT 'other',
    alloy TEXT NOT NULL,
    form TEXT NOT NULL,
    length_in REAL,
    width_in REAL,
    thickness_in REAL,
    diameter_in REAL,
    quantity INTEGER NOT NULL,
    weight_lbs REAL,
    price_cents INTEGER,
    zip TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    is_example INTEGER NOT NULL DEFAULT 0,
    delivery_mode TEXT NOT NULL DEFAULT 'pickup',
    delivery_radius_miles REAL,
    delivery_fee_cents INTEGER,
    certs_available INTEGER NOT NULL DEFAULT 0,
    certs_note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS listings_status_created ON listings (status, created_at)`,
  `CREATE INDEX IF NOT EXISTS listings_seller ON listings (seller_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    read_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS messages_recipient ON messages (recipient_id, read_at)`,
  `CREATE INDEX IF NOT EXISTS messages_listing ON messages (listing_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    UNIQUE (listing_id, reporter_id)
  )`,
];

let databasePromise: Promise<Client> | null = null;

export function createDbClient(url: string, authToken?: string): Client {
  return createClient({
    url,
    authToken,
    intMode: "number",
  });
}

export async function migrate(client: Client): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  try {
    await client.execute("PRAGMA journal_mode = WAL");
  } catch {
    // Remote libSQL chooses its own journal mode.
  }
  await client.batch(SCHEMA, "write");
  await upgradeListingColumns(client);
}

const LISTING_FILTERS_MIGRATION = "listing-metal-delivery-v1";

async function upgradeListingColumns(client: Client): Promise<void> {
  const columns = await tableColumns(client, "listings");
  const alters: string[] = [];
  if (!columns.has("metal_type")) {
    alters.push(
      "ALTER TABLE listings ADD COLUMN metal_type TEXT NOT NULL DEFAULT 'other'",
    );
  }
  if (!columns.has("delivery_mode")) {
    alters.push(
      "ALTER TABLE listings ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'pickup'",
    );
  }
  if (!columns.has("delivery_radius_miles")) {
    alters.push("ALTER TABLE listings ADD COLUMN delivery_radius_miles REAL");
  }
  if (!columns.has("delivery_fee_cents")) {
    alters.push("ALTER TABLE listings ADD COLUMN delivery_fee_cents INTEGER");
  }
  if (!columns.has("certs_available")) {
    alters.push(
      "ALTER TABLE listings ADD COLUMN certs_available INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!columns.has("certs_note")) {
    alters.push(
      "ALTER TABLE listings ADD COLUMN certs_note TEXT NOT NULL DEFAULT ''",
    );
  }
  const userColumns = await tableColumns(client, "users");
  if (!userColumns.has("verified_seller")) {
    alters.push(
      "ALTER TABLE users ADD COLUMN verified_seller INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (alters.length > 0) {
    await client.batch(
      alters.map((sql) => ({ sql })),
      "write",
    );
  }

  await client.execute(
    "CREATE INDEX IF NOT EXISTS listings_metal_status ON listings (metal_type, status)",
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS listings_delivery_status ON listings (delivery_mode, status)",
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS listings_certs_status ON listings (certs_available, status)",
  );

  const applied = await client.execute({
    sql: "SELECT id FROM schema_migrations WHERE id = ?",
    args: [LISTING_FILTERS_MIGRATION],
  });
  if (applied.rows[0]) return;

  await normalizeListingTaxonomy(client);
  await client.execute({
    sql: "INSERT INTO schema_migrations (id) VALUES (?)",
    args: [LISTING_FILTERS_MIGRATION],
  });
}

async function normalizeListingTaxonomy(client: Client): Promise<void> {
  const result = await client.execute(
    "SELECT id, material, alloy, form, metal_type FROM listings",
  );
  const statements: InStatement[] = [];
  for (const row of result.rows) {
    const id = String(row.id);
    const material = String(row.material ?? "");
    const alloy = String(row.alloy ?? "");
    const formRaw = String(row.form ?? "");
    const form = canonicalForm(formRaw) ?? formRaw;
    const current = String(row.metal_type ?? "other");
    const metalType =
      isMetalType(current) && current !== "other"
        ? current
        : inferMetalType(material, alloy);
    if (form === formRaw && metalType === current) continue;
    statements.push({
      sql: "UPDATE listings SET form = ?, metal_type = ? WHERE id = ?",
      args: [form, metalType, id],
    });
  }
  if (statements.length > 0) await client.batch(statements, "write");
}

async function tableColumns(client: Client, table: string): Promise<Set<string>> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return new Set(result.rows.map((row) => String(row.name)));
}

export async function seedIfEmpty(client: Client): Promise<void> {
  const tx = await client.transaction("write");
  try {
    const count = await tx.execute("SELECT COUNT(*) AS c FROM listings");
    if (numberValue(count.rows[0]?.c) > 0) {
      await tx.commit();
      return;
    }
    if (process.env.SEED_EXAMPLE_DATA === "false") {
      await tx.commit();
      return;
    }
    await seedExampleData(tx);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export function getDatabase(): Promise<Client> {
  if (!databasePromise) {
    databasePromise = openDatabase().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export function resetDatabaseForTests(): void {
  databasePromise = null;
}

async function openDatabase(): Promise<Client> {
  const config = resolveConfig();
  const client = createDbClient(config.url, config.authToken);
  await migrate(client);
  await seedIfEmpty(client);
  return client;
}

function resolveConfig(): { url: string; authToken?: string } {
  const url =
    process.env.LIBSQL_URL ||
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "";
  const authToken =
    process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
  const remote = url && !url.startsWith("file:");

  if (process.env.VERCEL && !remote) {
    throw new DatabaseConfigError(
      "Skrappily needs a remote libSQL database on Vercel. Set LIBSQL_URL and LIBSQL_AUTH_TOKEN to a Turso database. The local SQLite file is only for development.",
    );
  }

  if (remote) {
    if (!authToken) {
      throw new DatabaseConfigError(
        "LIBSQL_URL is set, but LIBSQL_AUTH_TOKEN is missing. Create a Turso database token and add it to the environment.",
      );
    }
    return { url, authToken };
  }

  const fileUrl = url.startsWith("file:") ? url : "file:./data/skrappily.db";
  const filePath = fileUrl.slice("file:".length);
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  return { url: fileUrl };
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

export type { InStatement };
