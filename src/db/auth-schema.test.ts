import { sql } from "drizzle-orm";
import { expect, it } from "vitest";

import { db } from "@/db";

it("создаёт таблицы входа и обязательных владельцев контактов и групп", async () => {
  const tables = await db.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables
    where table_schema = 'public'
  `);
  expect(tables.map((row) => row.table_name)).toEqual(
    expect.arrayContaining([
      "users",
      "sessions",
      "accounts",
      "verifications",
      "sign_in_link_requests",
    ]),
  );
  const columns = await db.execute<{ table_name: string; is_nullable: string }>(sql`
    select table_name, is_nullable from information_schema.columns
    where table_schema = 'public' and table_name in ('contacts', 'groups') and column_name = 'user_id'
  `);
  expect(columns).toHaveLength(2);
  expect(columns.every((column) => column.is_nullable === "NO")).toBe(true);
});
