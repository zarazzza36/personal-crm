// Applies the migrations from ./drizzle in the current folder: node migrate.mts
// The app image runs it in a one-off container before a new version starts
// (deploy/app/compose.yaml). Locally migrations go through `pnpm db:migrate`.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set.");
}

// No notices in the log: every run says the migrations schema already exists.
const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Migrations are applied.");
} finally {
  await client.end();
}
