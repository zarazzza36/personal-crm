// Helpers for addresses of databases on the same server. Used by the test setup only.

/** The name every test database ends with: `resetDatabase` refuses to clear any other one. */
export const TEST_DATABASE_SUFFIX = "_test";

/** The name of the database the address points to. */
export function databaseName(url: string) {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

/** The same address, pointing to another database of the same server. */
export function withDatabaseName(url: string, name: string) {
  const parsed = new URL(url);
  parsed.pathname = `/${encodeURIComponent(name)}`;
  return parsed.toString();
}

/** The address of the test database that lives next to the working one: `crm` → `crm_test`. */
export function testDatabaseUrl(workingUrl: string) {
  return withDatabaseName(workingUrl, `${databaseName(workingUrl)}${TEST_DATABASE_SUFFIX}`);
}

/**
 * The address of the e2e database: `crm` → `crm_e2e_test`. Apart from the Vitest one, so the two
 * kinds of tests may run at the same time without emptying each other's tables.
 */
export function e2eDatabaseUrl(workingUrl: string) {
  return withDatabaseName(workingUrl, `${databaseName(workingUrl)}_e2e${TEST_DATABASE_SUFFIX}`);
}
