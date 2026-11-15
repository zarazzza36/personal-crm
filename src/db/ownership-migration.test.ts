import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import postgres from "postgres";
import { expect, it } from "vitest";

import { withDatabaseName } from "@/test/database-url";

it("переносит существующие записи владельцу и откатывается без его почты", async () => {
  const name = `ownership_${randomUUID().replaceAll("-", "")}_migration_test`;
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
    const migrations = await Promise.all(
      journal.entries.map(({ tag }) => readFile(`drizzle/${tag}.sql`, "utf8")),
    );
    for (const migration of migrations.slice(0, -1)) await client.unsafe(migration).simple();
    await client`insert into contacts (name) values ('Старый контакт')`;
    await client`insert into notes (contact_id, body) values (1, 'Старая заметка')`;
    await client`insert into groups (name) values ('Старая группа')`;
    await client`insert into contact_groups (contact_id, group_id) values (1, 1)`;

    const latest = migrations.at(-1)!;
    await expect(client.begin(async (tx) => tx.unsafe(latest).simple())).rejects.toThrow(
      "OWNER_EMAIL",
    );
    const [rollback] = await client`select to_regclass('public.users') as users`;
    expect(rollback.users).toBeNull();
    expect(await client`select name from contacts`).toEqual([{ name: "Старый контакт" }]);

    await client`select set_config('crm.owner_email', ' Owner@Example.com ', false)`;
    await client.begin(async (tx) => tx.unsafe(latest).simple());
    const [owner] = await client`select id, email, email_verified from users`;
    expect(owner.email).toBe("owner@example.com");
    expect(owner.email_verified).toBe(true);
    expect((await client`select user_id from contacts`)[0].user_id).toBe(owner.id);
    expect((await client`select user_id from groups`)[0].user_id).toBe(owner.id);
    expect(await client`select body from notes`).toEqual([{ body: "Старая заметка" }]);
    expect(await client`select contact_id, group_id from contact_groups`).toEqual([
      { contact_id: 1, group_id: 1 },
    ]);
  } finally {
    await client.end();
    await server`drop database ${server(name)}`;
    await server.end();
  }
});
