import postgres from "postgres";
import { expect, it } from "vitest";

it("сериализует параллельные ссылки и сохраняет другие проверки", async () => {
  const client = postgres(process.env.DATABASE_URL!, { max: 3, onnotice: () => {} });
  try {
    await client`insert into verifications (id, identifier, value, expires_at)
      values ('other', 'other-check', 'not json', now() + interval '1 hour'),
             ('different', 'magic-link:other', '{"email":"other@example.com"}', now() + interval '1 hour')`;
    const insert = (id: string) => client`
      insert into verifications (id, identifier, value, expires_at)
      values (${id}, ${`magic-link:${id}`}, ${JSON.stringify({ email: "same@example.com" })}, now() + interval '1 hour')`;
    await Promise.all([insert("first"), insert("second")]);
    const rows = await client`select id from verifications order by id`;
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.id)).toEqual(expect.arrayContaining(["other", "different"]));
    expect(rows.filter((row) => row.id === "first" || row.id === "second")).toHaveLength(1);
  } finally {
    await client.end();
  }
});
