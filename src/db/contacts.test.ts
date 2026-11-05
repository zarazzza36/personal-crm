import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import type { ContactInput } from "@/lib/contact-input";
import { daysAgo, makeContact, makeNote } from "@/test/factories";

import { insertContact, updateContact } from "./contacts";
import { getContact, listDueContacts } from "./queries";
import { contacts } from "./schema";

/** The contact as the form sends it once checked: every field empty but the given ones. */
function contactInput(values: Partial<ContactInput> = {}): ContactInput {
  return {
    name: "Иван Петров",
    about: null,
    howWeMet: null,
    phone: null,
    email: null,
    capacityTons: null,
    volumeCubicMeters: null,
    bodyType: null,
    contactFrequency: null,
    ...values,
  };
}

async function frequencySetAt(contactId: number) {
  const [row] = await db
    .select({ at: contacts.contactFrequencySetAt })
    .from(contacts)
    .where(eq(contacts.id, contactId));
  return row.at;
}

/** The database's clock: the frequency is set by it, not by the clock of the tests. */
async function databaseNow() {
  const [row] = await db.execute<{ now: string }>(sql`select now()::text as now`);
  return new Date(row.now);
}

/** Today in Moscow plus `days`, as the database gives a day: "2026-11-12". */
async function moscowDayFromToday(days: number) {
  const [row] = await db.execute<{ day: string }>(
    sql`select ((now() at time zone 'Europe/Moscow')::date + ${days}::int)::text as day`,
  );
  return row.day;
}

describe("insertContact", () => {
  // Scenario "Задали частоту при добавлении"
  it("saves the frequency and starts the countdown now", async () => {
    const before = await databaseNow();
    const id = await insertContact(db, contactInput({ contactFrequency: "month" }));

    const contact = await getContact(id);
    expect(contact.contactFrequency).toBe("month");
    expect((await frequencySetAt(id))!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  // Scenario "Добавили контакт, не трогая поле"
  it("leaves the frequency and its start empty when none is chosen", async () => {
    const id = await insertContact(db, contactInput());

    const contact = await getContact(id);
    expect(contact.contactFrequency).toBeNull();
    expect(await frequencySetAt(id)).toBeNull();
    expect(contact.dueDay).toBeNull();
    expect(contact.isDue).toBe(false);
    expect(await listDueContacts()).toEqual([]);
  });

  // Scenario "Заметок нет": until the first note the countdown starts the day the frequency is set.
  it("counts the term from today while there are no notes", async () => {
    const id = await insertContact(db, contactInput({ contactFrequency: "week" }));

    const contact = await getContact(id);
    expect(contact.dueDay).toBe(await moscowDayFromToday(7));
    expect(contact.isDue).toBe(false);
  });
});

describe("updateContact", () => {
  // Scenario "Изменили частоту" and "Сменили частоту у контакта без заметок"
  it("starts the countdown again when the frequency changes", async () => {
    const id = await makeContact("Иван Петров", {
      contactFrequency: "month",
      contactFrequencySetAt: daysAgo(19),
    });
    const before = await databaseNow();

    await updateContact(db, id, contactInput({ contactFrequency: "week" }));

    const contact = await getContact(id);
    expect(contact.contactFrequency).toBe("week");
    expect((await frequencySetAt(id))!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    // A week after the change, not after the day the month was set.
    expect(contact.dueDay).toBe(await moscowDayFromToday(7));
    expect(contact.isDue).toBe(false);
  });

  // Scenario "Сохранили контакт, частоту не меняли"
  it("keeps the countdown when the contact is saved with the same frequency", async () => {
    const setAt = daysAgo(19);
    const id = await makeContact("Иван Петров", {
      contactFrequency: "month",
      contactFrequencySetAt: setAt,
    });
    const dueDayBefore = (await getContact(id)).dueDay;

    await updateContact(
      db,
      id,
      contactInput({ contactFrequency: "month", phone: "+7 000 111-22-33" }),
    );

    const contact = await getContact(id);
    expect(contact.phone).toBe("+7 000 111-22-33");
    expect(await frequencySetAt(id)).toEqual(setAt);
    expect(contact.dueDay).toBe(dueDayBefore);
  });

  // Scenario "Старая заметка, частоту задали сегодня": the old note counts, not the day the
  // frequency was set.
  it("puts the contact in the block at once when its last note is older than the term", async () => {
    const id = await makeContact("Иван Петров");
    await makeNote(id, { createdAt: daysAgo(730) });

    await updateContact(db, id, contactInput({ contactFrequency: "month" }));

    expect(await listDueContacts()).toEqual([
      { id, name: "Иван Петров", contactFrequency: "month", daysSinceLastNote: 730 },
    ]);
  });

  // Scenario "Сменили частоту у контакта с заметками"
  it("counts a new frequency from the last note, not from the change", async () => {
    const id = await makeContact("Иван Петров", {
      contactFrequency: "quarter",
      contactFrequencySetAt: daysAgo(30),
    });
    await makeNote(id, { createdAt: daysAgo(19) });
    expect((await getContact(id)).isDue).toBe(false);

    await updateContact(db, id, contactInput({ contactFrequency: "week" }));

    const contact = await getContact(id);
    expect(contact.dueDay).toBe(await moscowDayFromToday(-12));
    expect(contact.isDue).toBe(true);
  });

  // Scenario "Убрали частоту"
  it("takes the contact out of the block when the frequency is removed", async () => {
    const id = await makeContact("Иван Петров", {
      contactFrequency: "week",
      contactFrequencySetAt: daysAgo(30),
    });
    expect(await listDueContacts()).toHaveLength(1);

    await updateContact(db, id, contactInput({ contactFrequency: null }));

    const contact = await getContact(id);
    expect(contact.contactFrequency).toBeNull();
    expect(await frequencySetAt(id)).toBeNull();
    expect(contact.dueDay).toBeNull();
    expect(await listDueContacts()).toEqual([]);
  });

  it("gives nothing when the contact is gone, for example deleted in another tab", async () => {
    expect(await updateContact(db, 999, contactInput())).toBeUndefined();
  });
});
