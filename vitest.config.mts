// A .mts file with no imports from src: Vite loads such a config as plain ESM, without warnings.

import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// The global setup reads DATABASE_URL from here to find the server and create the test database.
config({ quiet: true });

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Same as `paths` in tsconfig.json.
      "@": fromRoot("./src"),
      // Next.js swaps this package for an empty one on the server; tests run outside Next.js.
      "server-only": fromRoot("./node_modules/server-only/empty.js"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // There is one database for all the tests: files run one after another.
    fileParallelism: false,
  },
});
