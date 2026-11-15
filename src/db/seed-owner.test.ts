import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { eq } from "drizzle-orm";
import { expect, it } from "vitest";

import { db } from "@/db";
import { contacts, groups, users } from "@/db/schema";

const run = promisify(execFile);
const seed = (ownerEmail: string) =>
  run(process.execPath, ["--import", "tsx", "src/db/seed.ts"], {
    env: { ...process.env, OWNER_EMAIL: ownerEmail },
    timeout: 30_000,
  });

it("создаёт тестовые данные у владельца из настроек", async () => {
  await seed(" Owner@Example.com ");
  const [owner] = await db.select().from(users).where(eq(users.email, "owner@example.com"));
  expect(owner).toBeDefined();
  expect(await db.$count(contacts, eq(contacts.userId, owner.id))).toBe(1000);
  expect(await db.$count(groups, eq(groups.userId, owner.id))).toBe(5);
});

it("не заполняет базу без почты владельца", async () => {
  await expect(seed("")).rejects.toThrow("OWNER_EMAIL is required");
  expect(await db.$count(contacts)).toBe(0);
});
