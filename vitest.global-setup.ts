// Runs once before all the tests: makes sure the test database exists and has the current tables.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

import { databaseName, testDatabaseUrl } from "./src/test/database-url";

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
  const testName = databaseName(testUrl);

  const server = postgres(workingUrl, { max: 1, onnotice: () => {} });
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

  project.provide("testDatabaseUrl", testUrl);
}
