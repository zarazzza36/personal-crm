// Runs in every test process before its test files.

import { afterAll, beforeEach, inject } from "vitest";

// First of all: `@/db` reads the address once, when it is imported for the first time, and
// every import of it below is dynamic for that reason. From here on no test can reach the
// working database.
process.env.DATABASE_URL = inject("testDatabaseUrl");

// Every test starts with empty tables. `resetDatabase` refuses to touch any database
// but a test one.
beforeEach(async () => {
  const { resetDatabase } = await import("@/test/database");
  await resetDatabase();
});

// An open connection pool keeps the test process from finishing.
afterAll(async () => {
  const { db } = await import("@/db");
  await db.$client.end();
});
