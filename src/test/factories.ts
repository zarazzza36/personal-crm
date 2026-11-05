// Short ways to put rows into the test database. Tests use the real tables, so a test says
// what it needs ("a contact in two groups") and nothing about how the rows get there.

import { db } from "@/db";
import { createGroup } from "@/db/groups";
import { contactGroups, contacts } from "@/db/schema";

/** Creates a group that must succeed and gives its id. */
export async function makeGroup(name: string) {
  const result = await createGroup(name);
  if (!result.ok) throw new Error(`Could not create "${name}": ${result.error}`);
  return result.id;
}

export async function makeContact(
  name: string,
  values: Partial<typeof contacts.$inferInsert> = {},
) {
  const [contact] = await db
    .insert(contacts)
    .values({ ...values, name })
    .returning({ id: contacts.id });
  return contact.id;
}

export async function addToGroup(contactId: number, groupId: number) {
  await db.insert(contactGroups).values({ contactId, groupId });
}

/**
 * Creates `count` contacts named "<prefix> 001", "<prefix> 002" and so on: in the list they go
 * in the order of their numbers. Gives their ids.
 */
export async function makeContacts(count: number, prefix = "Контакт") {
  const rows = await db
    .insert(contacts)
    .values(
      Array.from({ length: count }, (_, index) => ({
        name: `${prefix} ${String(index + 1).padStart(3, "0")}`,
      })),
    )
    .returning({ id: contacts.id });
  return rows.map((row) => row.id);
}

export async function addAllToGroup(contactIds: number[], groupId: number) {
  await db.insert(contactGroups).values(contactIds.map((contactId) => ({ contactId, groupId })));
}
