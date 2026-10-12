import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { ContactCursor, ContactListItem, ContactsPage } from "@/lib/contact-list";

import { db } from "./index";
import { contacts, notes } from "./schema";

const contactListColumns = {
  id: contacts.id,
  name: contacts.name,
  about: contacts.about,
  phone: contacts.phone,
  email: contacts.email,
};

const nameInRussianOrder = sql`${contacts.name} collate "ru-x-icu"`;

// Russian alphabetical order; the id keeps namesakes in a fixed order.
const alphabeticalOrder = [nameInRussianOrder, asc(contacts.id)];

// Search ignores letter case and treats "ё" and "е" as the same letter.
function normalizeForSearch(value: string) {
  return value.toLowerCase().replaceAll("ё", "е");
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** All contacts whose name contains every word of `query`, in Russian alphabetical order. */
export async function searchContacts(query: string): Promise<ContactListItem[]> {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  const nameMatches = words.map(
    (word) =>
      sql`replace(lower(${contacts.name}), 'ё', 'е') like ${`%${escapeLikePattern(word)}%`}`,
  );

  return db
    .select(contactListColumns)
    .from(contacts)
    .where(and(...nameMatches))
    .orderBy(...alphabeticalOrder);
}

/** Up to `limit` contacts in Russian alphabetical order, starting right after `cursor`. */
export async function listContactsPage(
  cursor: ContactCursor | null,
  limit: number,
): Promise<ContactsPage> {
  const rows = await db
    .select(contactListColumns)
    .from(contacts)
    .where(
      cursor
        ? sql`(${nameInRussianOrder}, ${contacts.id}) > (${cursor.name}, ${cursor.id})`
        : undefined,
    )
    .orderBy(...alphabeticalOrder)
    // One extra row tells whether the list goes on after this page.
    .limit(limit + 1);

  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: last && rows.length > limit ? { name: last.name, id: last.id } : null,
  };
}

export async function countContacts() {
  return db.$count(contacts);
}

/** The contact as a row of the list. */
export async function getContactListItem(id: number): Promise<ContactListItem | undefined> {
  const [contact] = await db.select(contactListColumns).from(contacts).where(eq(contacts.id, id));
  return contact;
}

export async function getContact(id: number) {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
  return contact;
}

export async function listNotes(contactId: number) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}
