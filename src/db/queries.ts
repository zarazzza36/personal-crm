import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNotNull,
  lte,
  max,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { bodyTypesMatching } from "@/lib/body-types";
import {
  contactFrequencies,
  type ContactFrequency,
  type DueContact,
} from "@/lib/contact-frequency";
import type { ContactCursor, ContactListItem, ContactsPage } from "@/lib/contact-list";
import { parseContactSearch, type Range } from "@/lib/contact-search";
import { appTimeZone } from "@/lib/moscow-time";
import { NOTE_EXCERPT_LENGTH, type Reminder } from "@/lib/reminders";

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

// The moment of the contact's last note, null without notes; joined laterally to each contact.
const lastNote = db
  .select({ at: max(notes.createdAt).as("last_note_at") })
  .from(notes)
  .where(eq(notes.contactId, contacts.id))
  .as("last_note");

const frequencyIntervals: Record<ContactFrequency, string> = {
  week: "7 days",
  month: "1 month",
  quarter: "3 months",
  year: "1 year",
};

/** The Moscow date of the moment: neither the time of day nor the server's zone matters. */
function moscowDay(moment: SQLWrapper) {
  return sql`(${moment} at time zone ${appTimeZone})::date`;
}

const today = moscowDay(sql`now()`);

/**
 * The Moscow day it is time to talk to the contact again ("2026-11-15"); null without a frequency.
 * The frequency counts from the day of the last note, or, before the first note, from the day
 * the frequency was set. Months are calendar ones: PostgreSQL moves 31 January + 1 month
 * to the last day of February. Needs `lastNote` joined.
 */
const dueDay = sql<string | null>`(
  ${moscowDay(sql`coalesce(${lastNote.at}, ${contacts.contactFrequencySetAt})`)}
  + case ${contacts.contactFrequency}
    ${sql.join(
      contactFrequencies.map(
        (frequency) => sql`when ${frequency} then ${frequencyIntervals[frequency]}::interval`,
      ),
      sql` `,
    )}
  end
)::date`;

// From the due day on, it is time: the contact is in "Пора связаться".
const isDue = sql<boolean>`coalesce(${dueDay} <= ${today}, false)`;

// Days since the last note; null without notes.
const daysSinceLastNote = sql<number | null>`${today} - ${moscowDay(lastNote.at)}`;

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

/** The contact with the day it is time to talk to them again. */
export async function getContact(id: number) {
  const [contact] = await db
    .select({ ...getTableColumns(contacts), dueDay, isDue })
    .from(contacts)
    .crossJoinLateral(lastNote)
    .where(eq(contacts.id, id));
  return contact;
}

/** Contacts it is time to talk to: the earliest due day first, then alphabetically. */
export async function listDueContacts(): Promise<DueContact[]> {
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      contactFrequency: contacts.contactFrequency,
      daysSinceLastNote,
    })
    .from(contacts)
    .crossJoinLateral(lastNote)
    .where(and(isNotNull(contacts.contactFrequency), isDue))
    .orderBy(asc(dueDay), ...alphabeticalOrder);

  return rows.flatMap(({ contactFrequency, ...row }) =>
    contactFrequency ? [{ ...row, contactFrequency }] : [],
  );
}

/** Every note with a reminder, due or still ahead, the earliest first. */
export async function listReminders(): Promise<Reminder[]> {
  const rows = await db
    .select({
      noteId: notes.id,
      remindAt: notes.remindAt,
      contactId: contacts.id,
      contactName: contacts.name,
      noteExcerpt: sql<string>`left(${notes.body}, ${NOTE_EXCERPT_LENGTH})`,
    })
    .from(notes)
    .innerJoin(contacts, eq(notes.contactId, contacts.id))
    .where(isNotNull(notes.remindAt))
    .orderBy(asc(notes.remindAt), asc(notes.id));

  return rows.flatMap(({ remindAt, ...row }) => (remindAt ? [{ ...row, remindAt }] : []));
}

export async function listNotes(contactId: number) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}
