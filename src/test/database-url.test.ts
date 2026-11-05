import { expect, it } from "vitest";

import { e2eDatabaseUrl, TEST_DATABASE_SUFFIX, testDatabaseUrl } from "./database-url";

const workingUrl = "postgres://user:secret@localhost:5432/personal_crm";

it("puts the Vitest database next to the working one", () => {
  expect(testDatabaseUrl(workingUrl)).toBe(
    "postgres://user:secret@localhost:5432/personal_crm_test",
  );
});

it("puts the e2e database next to the working one, apart from the Vitest one", () => {
  const url = e2eDatabaseUrl(workingUrl);

  expect(url).toBe("postgres://user:secret@localhost:5432/personal_crm_e2e_test");
  expect(url).not.toBe(testDatabaseUrl(workingUrl));
  // Only a test database may be emptied: the e2e one is a test database too.
  expect(url.endsWith(TEST_DATABASE_SUFFIX)).toBe(true);
});
