// Makes a test database ready: creates it next to the working one if it is missing and applies
// the migrations from `drizzle`. Used by the setups of Vitest and Playwright.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { databaseName } from "./database-url";

/**
 * `serverUrl` points to any database of the same server: it is only used to create the test
 * database, nothing is changed in it.
 */
export async function prepareTestDatabase(serverUrl: string, testUrl: string) {
  const testName = databaseName(testUrl);

  const server = postgres(serverUrl, { max: 1, onnotice: () => {} });
  try {
    const [existing] = await server`select 1 from pg_database where datname = ${testName}`;
    if (!existing) {
      await server`create database ${server(testName)}`;
    }
  } finally {
    await server.end();
  }

  const client = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}
