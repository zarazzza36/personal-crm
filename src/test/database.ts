import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { db } from "@/db";

import { TEST_DATABASE_SUFFIX } from "./database-url";

/**
 * Empties every table of the database and starts the ids from 1 again.
 * Refuses to touch a database whose name does not end with `_test`: the working contacts must
 * survive even if the tests were pointed at the wrong database.
 */
export async function resetDatabase(database: PostgresJsDatabase = db) {
  const [current] = await database.execute<{ name: string }>(
    sql`select current_database() as name`,
  );
  if (!current.name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Refusing to empty database "${current.name}": a test database name must end with "${TEST_DATABASE_SUFFIX}"`,
    );
  }

  const tables = await database.execute<{ name: string }>(
    sql`select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`,
  );
  if (tables.length > 0) {
    const names = sql.raw(tables.map((table) => table.name).join(", "));
    await database.execute(sql`truncate table ${names} restart identity cascade`);
  }
}
