// Runs before the e2e server starts (see `webServer` in playwright.config.ts): makes sure the e2e
// database exists and has the current tables. DATABASE_URL already points to the e2e database.

import { TEST_DATABASE_SUFFIX, databaseName, withDatabaseName } from "../src/test/database-url";
import { prepareTestDatabase } from "../src/test/prepare-test-database";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set: run the e2e tests with `pnpm test:e2e`.");
}
if (!databaseName(url).endsWith(TEST_DATABASE_SUFFIX)) {
  throw new Error(`The e2e server must work with a test database, not "${databaseName(url)}"`);
}

// The e2e database may not exist yet: it is created from `postgres`, the server's own database.
prepareTestDatabase(withDatabaseName(url, "postgres"), url).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
