// "Пора связаться": how the database counts the term of a contact and who is in the block.
// The tests put contacts and notes with the dates they need; the term is counted by the database.

import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import type { ContactFrequency } from "@/lib/contact-frequency";
import { daysAgo, makeContact, makeNote } from "@/test/factories";

import { getContact, listDueContacts } from "./queries";
import { contacts } from "./schema";

/** A moment by Moscow clocks: "2026-10-01T23:50". */
function moscow(dateTime: string) {
  return new Date(`${dateTime}:00+03:00`);
}

/** The day the term ends for a contact whose last note is at `noteAt`. */
async function dueDayAfterNote(frequency: ContactFrequency, noteAt: Date, name = "Иван Петров") {
  const id = await makeContact(name, {
    contactFrequency: frequency,
    contactFrequencySetAt: noteAt,
  });
  await makeNote(id, { createdAt: noteAt });
  return (await getContact(id)).dueDay;
}

/** A contact with the frequency whose last note was `days` days ago. */
async function contactNotedDaysAgo(name: string, frequency: ContactFrequency, days: number) {
  const id = await makeContact(name, {
    contactFrequency: frequency,
    contactFrequencySetAt: daysAgo(days + 30),
  });
  await makeNote(id, { createdAt: daysAgo(days) });
  return id;
}

/** Names in the block, top to bottom. */
async function dueNames() {
  return (await listDueContacts()).map((contact) => contact.name);
}

describe("the day the term ends", () => {
  // Scenario "Раз в неделю": 7 days.
  it("is a week after the note for once a week", async () => {
    expect(await dueDayAfterNote("week", moscow("2026-10-01T12:00"))).toBe("2026-10-08");
  });

  // Scenario "Раз в месяц": a calendar month.
  it("is the same day of the next month for once a month", async () => {
    expect(await dueDayAfterNote("month", moscow("2027-01-15T12:00"))).toBe("2027-02-15");
  });

  // Scenario "Конец месяца"
  it("is the last day of the month when the month has no such day", async () => {
    expect(await dueDayAfterNote("month", moscow("2027-01-31T12:00"))).toBe("2027-02-28");
  });

  // Scenario "Раз в квартал и раз в год"
  it("is three calendar months later for once a quarter", async () => {
    expect(await dueDayAfterNote("quarter", moscow("2026-03-10T12:00"))).toBe("2026-06-10");
  });

  it("is the same day of the next year for once a year", async () => {
    expect(await dueDayAfterNote("year", moscow("2026-03-10T12:00"))).toBe("2027-03-10");
  });

  // Scenario "Заметка поздно вечером": the day of the note is the Moscow one.
  it("counts from the Moscow day of a note written late in the evening", async () => {
    expect(await dueDayAfterNote("week", moscow("2026-10-01T23:50"))).toBe("2026-10-08");
  });

  it("counts from the Moscow day of a note written after midnight, still the day before in UTC", async () => {
    // 2 October 00:10 in Moscow is 1 October 21:10 in UTC.
    expect(await dueDayAfterNote("week", moscow("2026-10-02T00:10"))).toBe("2026-10-09");
  });

  // Scenario "Заметок нет": before the first note the term counts from the day the frequency was set.
  it("counts from the day the frequency was set while there are no notes", async () => {
    const id = await makeContact("Иван Петров", {
      contactFrequency: "month",
      contactFrequencySetAt: moscow("2026-11-01T10:00"),
    });

    expect((await getContact(id)).dueDay).toBe("2026-12-01");
  });

  // Scenario "Написали заметку": a new note starts the term again.
  it("counts from the last note, not from older ones", async () => {
    const id = await makeContact("Иван Петров", {
      contactFrequency: "week",
      contactFrequencySetAt: moscow("2026-09-01T10:00"),
    });
    await makeNote(id, { createdAt: moscow("2026-09-10T10:00") });
    await makeNote(id, { createdAt: moscow("2026-10-01T10:00") });
    await makeNote(id, { createdAt: moscow("2026-09-20T10:00") });

    expect((await getContact(id)).dueDay).toBe("2026-10-08");
  });

  it("is not there for a contact without a frequency", async () => {
    const id = await makeContact("Иван Петров");
    await makeNote(id, { createdAt: daysAgo(400) });

    const contact = await getContact(id);
    expect(contact.dueDay).toBeNull();
    expect(contact.isDue).toBe(false);
  });
});

describe("whether it is time to talk", () => {
  // Scenario "Раз в неделю": 7 October no, from 8 October yes.
  it("is not yet the day before the term ends", async () => {
    const id = await contactNotedDaysAgo("Иван Петров", "week", 6);

    expect((await getContact(id)).isDue).toBe(false);
    expect(await listDueContacts()).toEqual([]);
  });

  it("is from the day the term ends", async () => {
    const id = await contactNotedDaysAgo("Иван Петров", "week", 7);

    expect((await getContact(id)).isDue).toBe(true);
    expect(await dueNames()).toEqual(["Иван Петров"]);
  });

  it("stays after the term has ended", async () => {
    await contactNotedDaysAgo("Иван Петров", "week", 40);

    expect(await dueNames()).toEqual(["Иван Петров"]);
  });

  // Scenario "Написали заметку"
  it("is over once a note is written today", async () => {
    const id = await contactNotedDaysAgo("Иван Петров", "week", 40);
    await makeNote(id);

    expect(await listDueContacts()).toEqual([]);
    const [today] = await db.execute<{ day: string }>(
      sql`select ((now() at time zone 'Europe/Moscow')::date + 7)::text as day`,
    );
    expect((await getContact(id)).dueDay).toBe(today.day);
  });

  // Scenario "Заметок нет": the contact is in the block once the term from the frequency ends.
  it("comes for a contact without notes once the term from the frequency ends", async () => {
    const id = await makeContact("Иван Петров", {
      contactFrequency: "week",
      contactFrequencySetAt: daysAgo(7),
    });

    expect(await listDueContacts()).toEqual([
      { id, name: "Иван Петров", contactFrequency: "week", daysSinceLastNote: null },
    ]);
  });

  // Scenario "Добавили контакт, не трогая поле"
  it("never comes for a contact without a frequency", async () => {
    const id = await makeContact("Иван Петров", { createdAt: daysAgo(1000) });
    await makeNote(id, { createdAt: daysAgo(900) });

    expect(await listDueContacts()).toEqual([]);
  });
});

describe("the block «Пора связаться»", () => {
  // Scenario "Есть кому позвонить"
  it("has only the contacts whose term has ended", async () => {
    await contactNotedDaysAgo("Анна", "week", 10);
    await contactNotedDaysAgo("Борис", "month", 40);
    await contactNotedDaysAgo("Вера", "year", 400);
    await contactNotedDaysAgo("Глеб", "week", 3);
    await makeContact("Дина");

    expect(await dueNames()).toEqual(["Вера", "Борис", "Анна"]);
  });

  // Scenario "Никому не пора"
  it("is empty when nobody's term has ended", async () => {
    await contactNotedDaysAgo("Анна", "week", 2);
    await contactNotedDaysAgo("Борис", "year", 100);
    await makeContact("Вера");

    expect(await listDueContacts()).toEqual([]);
  });

  // Scenario "Удалили контакт"
  it("loses a contact deleted for good", async () => {
    await contactNotedDaysAgo("Анна", "week", 10);
    const id = await contactNotedDaysAgo("Борис", "week", 10);

    await db.delete(contacts).where(eq(contacts.id, id));

    expect(await dueNames()).toEqual(["Анна"]);
  });

  // Scenario "Разные частоты": the longest overdue first, whatever the frequency.
  it("puts the contact whose term ended earliest on top", async () => {
    // A year ago all three terms have ended: Иван's month on 5 October, Анна's week
    // on 15 October, Олег's year on 1 October.
    await dueDayAfterNote("month", moscow("2025-09-05T12:00"), "Иван");
    await dueDayAfterNote("week", moscow("2025-10-08T12:00"), "Анна");
    await dueDayAfterNote("year", moscow("2024-10-01T12:00"), "Олег");

    expect(await dueNames()).toEqual(["Олег", "Иван", "Анна"]);
  });

  // Scenario "Срок вышел в один день"
  it("puts contacts whose terms ended the same day in alphabetical order", async () => {
    await contactNotedDaysAgo("Борис", "week", 10);
    await contactNotedDaysAgo("Алла", "week", 10);
    await contactNotedDaysAgo("Ёлка", "week", 10);
    await contactNotedDaysAgo("Жанна", "week", 10);

    expect(await dueNames()).toEqual(["Алла", "Борис", "Ёлка", "Жанна"]);
  });

  // Scenario "Контакт с заметками" and "Старая заметка, частоту задали сегодня"
  it("gives the days since the last note", async () => {
    const id = await contactNotedDaysAgo("Иван", "month", 45);

    expect(await listDueContacts()).toEqual([
      { id, name: "Иван", contactFrequency: "month", daysSinceLastNote: 45 },
    ]);
  });

  // Scenario "Контакт без заметок"
  it("gives no days for a contact without notes", async () => {
    const id = await makeContact("Олег", {
      contactFrequency: "year",
      contactFrequencySetAt: daysAgo(400),
    });

    expect(await listDueContacts()).toEqual([
      { id, name: "Олег", contactFrequency: "year", daysSinceLastNote: null },
    ]);
  });
});
