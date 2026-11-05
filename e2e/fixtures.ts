// What every e2e test gets: a connection to the e2e database, emptied before the test, so a test
// starts from nothing and says itself what it needs in the database.

import { test as base } from "@playwright/test";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { resetTestDatabase } from "../src/test/reset-test-database";

type TestFixtures = {
  /** Empties the tables before every test; nobody asks for it by name. */
  emptyDatabase: void;
};

type WorkerFixtures = {
  /** The e2e database, the same the app under test works with. */
  database: PostgresJsDatabase;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  database: [
    // Playwright needs the fixtures argument even when the fixture uses none of them.
    async ({}, use) => {
      const url = process.env.E2E_DATABASE_URL;
      if (!url) {
        throw new Error("E2E_DATABASE_URL is not set: playwright.config.ts sets it.");
      }
      const client = postgres(url, { max: 1, onnotice: () => {} });
      await use(drizzle(client));
      await client.end();
    },
    { scope: "worker" },
  ],

  emptyDatabase: [
    async ({ database }, use) => {
      // Refuses any database whose name does not end with `_test`.
      await resetTestDatabase(database);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
