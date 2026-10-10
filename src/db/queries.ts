import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "./index";
import { contacts, notes } from "./schema";

// Search ignores letter case and treats "ё" and "е" as the same letter.
function normalizeForSearch(value: string) {
  return value.toLowerCase().replaceAll("ё", "е");
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** Contacts in Russian alphabetical order; every word of `query` must occur in the name. */
export async function listContacts(query: string) {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  const nameMatches = words.map(
    (word) =>
      sql`replace(lower(${contacts.name}), 'ё', 'е') like ${`%${escapeLikePattern(word)}%`}`,
  );

  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(and(...nameMatches))
    .orderBy(sql`${contacts.name} collate "ru-x-icu"`, asc(contacts.id));
}

export async function countContacts() {
  return db.$count(contacts);
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
