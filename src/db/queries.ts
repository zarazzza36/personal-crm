import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { bodyTypesMatching } from "@/lib/body-types";
import type { ContactCursor, ContactListItem, ContactsPage } from "@/lib/contact-list";
import { parseContactSearch, type Range } from "@/lib/contact-search";

import { db } from "./index";
import { contacts, notes } from "./schema";

const contactListColumns = {
  id: contacts.id,
  name: contacts.name,
  about: contacts.about,
  phone: contacts.phone,
  email: contacts.email,
  capacityTons: contacts.capacityTons,
  volumeCubicMeters: contacts.volumeCubicMeters,
  bodyType: contacts.bodyType,
};

const nameInRussianOrder = sql`${contacts.name} collate "ru-x-icu"`;

// Russian alphabetical order; the id keeps namesakes in a fixed order.
const alphabeticalOrder = [nameInRussianOrder, asc(contacts.id)];

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** The word is a part of the name or stands for the body type ("тент"). */
function matchesWord(word: string) {
  const nameMatch = sql`replace(lower(${contacts.name}), 'ё', 'е') like ${`%${escapeLikePattern(word)}%`}`;
  const bodyTypes = bodyTypesMatching(word);
  return bodyTypes.length > 0 ? or(nameMatch, inArray(contacts.bodyType, bodyTypes)) : nameMatch;
}

/** The value is within the range; a contact without the value is never within one. */
function withinRange(column: PgColumn, range: Range | null): SQL[] {
  if (!range) return [];
  return [
    ...(range.min !== null ? [gte(column, range.min)] : []),
    ...(range.max !== null ? [lte(column, range.max)] : []),
  ];
}

/**
 * All contacts that match every part of `query`, in Russian alphabetical order:
 * words in the name or the body type, and the tons and cubic meters asked for ("от 5 тонн").
 */
export async function searchContacts(query: string): Promise<ContactListItem[]> {
  const { words, tons, cubicMeters } = parseContactSearch(query);

  return db
    .select(contactListColumns)
    .from(contacts)
    .where(
      and(
        ...words.map(matchesWord),
        ...withinRange(contacts.capacityTons, tons),
        ...withinRange(contacts.volumeCubicMeters, cubicMeters),
      ),
    )
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
