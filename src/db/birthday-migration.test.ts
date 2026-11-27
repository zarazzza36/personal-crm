import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import postgres from "postgres";
import { expect, it } from "vitest";

import { withDatabaseName } from "@/test/database-url";

it("оставляет дату рождения пустой у контакта, созданного до миграции", async () => {
  const name = `birthday_${randomUUID().replaceAll("-", "")}_migration_test`;
  const server = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await server`create database ${server(name)}`;
  const client = postgres(withDatabaseName(process.env.DATABASE_URL!, name), {
    max: 1,
    onnotice: () => {},
  });

  try {
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as {
      entries: { tag: string }[];
    };
    const birthdayTag = "0006_contact_birthdays";
    for (const { tag } of journal.entries) {
      if (tag === birthdayTag) break;
      await client.unsafe(await readFile(`drizzle/${tag}.sql`, "utf8")).simple();
    }
    await client`insert into users (id, name, email) values ('owner', 'Владелец', 'owner@example.com')`;
    await client`insert into contacts (name, user_id) values ('Старый контакт', 'owner')`;

    await client.unsafe(await readFile(`drizzle/${birthdayTag}.sql`, "utf8")).simple();

    expect(await client`select name, user_id, birth_date from contacts`).toEqual([
      { name: "Старый контакт", user_id: "owner", birth_date: null },
    ]);
  } finally {
    await client.end();
    await server`drop database ${server(name)}`;
    await server.end();
  }
});
