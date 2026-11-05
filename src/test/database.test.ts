import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { expect, it } from "vitest";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";

import { resetDatabase } from "./database";
import { withDatabaseName } from "./database-url";

it("empties every table and starts the ids from 1 again", async () => {
  const [first] = await db.insert(contacts).values({ name: "Иван" }).returning();
  await db.insert(notes).values({ contactId: first.id, body: "Позвонить" });

  await resetDatabase();

  expect(await db.$count(contacts)).toBe(0);
  expect(await db.$count(notes)).toBe(0);
  const [second] = await db.insert(contacts).values({ name: "Пётр" }).returning();
  expect(second.id).toBe(1);
});

it("refuses to empty a database whose name does not end with _test", async () => {
  // A real database next to the test one, with a name that is not a test one, and a row in it.
  const testUrl = process.env.DATABASE_URL!;
  const otherName = "reset_guard_check";
  const server = postgres(testUrl, { max: 1 });
  await server`drop database if exists ${server(otherName)} with (force)`;
  await server`create database ${server(otherName)}`;
  const other = postgres(withDatabaseName(testUrl, otherName), { max: 1 });

  try {
    await other`create table people (id integer)`;
    await other`insert into people values (1)`;

    await expect(resetDatabase(drizzle(other))).rejects.toThrow(otherName);

    const [row] = await other`select count(*)::int as count from people`;
    expect(row.count).toBe(1);
  } finally {
    await other.end();
    await server`drop database if exists ${server(otherName)} with (force)`;
    await server.end();
  }
});
