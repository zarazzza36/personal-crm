import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { db } from "@/db";

import { resetTestDatabase } from "./reset-test-database";

/**
 * Empties every table of the test database and starts the ids from 1 again; by default the one
 * the app's `db` works with. Refuses any database whose name does not end with `_test`.
 */
export async function resetDatabase(database: PostgresJsDatabase = db) {
  await resetTestDatabase(database);
}
