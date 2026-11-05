// Runs once before all the tests: makes sure the test database exists and has the current tables.

import type { TestProject } from "vitest/node";

import { testDatabaseUrl } from "./src/test/database-url";
import { prepareTestDatabase } from "./src/test/prepare-test-database";

declare module "vitest" {
  export interface ProvidedContext {
    /** The address of the database the tests work with; vitest.setup.ts puts it in DATABASE_URL. */
    testDatabaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const workingUrl = process.env.DATABASE_URL;
  if (!workingUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  const testUrl = testDatabaseUrl(workingUrl);

  await prepareTestDatabase(workingUrl, testUrl);

  project.provide("testDatabaseUrl", testUrl);
}
