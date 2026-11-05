// "Пора связаться" (openspec/specs/keep-in-touch): the main ways the user goes through it in the
// browser. How the term is counted is checked in src/db/keep-in-touch.test.ts; here the tests
// check what the user sees and does.

import type { Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { contacts, notes } from "../src/db/schema";
import type { ContactFrequency } from "../src/lib/contact-frequency";
import { formatDay } from "../src/lib/format";
import { toMoscowInput } from "../src/lib/moscow-time";

import { expect, test } from "./fixtures";

const ERROR_MESSAGE = "Не удалось сохранить, попробуйте ещё раз";

const keepInTouch = (page: Page) => page.getByRole("region", { name: /^Пора связаться/ });
const keepInTouchRows = (page: Page) => keepInTouch(page).getByRole("listitem");
const keepInTouchRow = (page: Page, name: string) =>
  keepInTouchRows(page).filter({ has: page.getByText(name, { exact: true }) });
const contactList = (page: Page) => page.getByRole("list", { name: "Список контактов" });
const noteList = (page: Page) => page.getByRole("list", { name: "Заметки о контакте" });
/** The value of the card's line «Как часто общаться». */
const frequencyLine = (page: Page) =>
  page.locator("dt", { hasText: /^Как часто общаться$/ }).locator("xpath=following-sibling::dd[1]");

/** The moment `days` days ago; Moscow has no daylight saving time, so it is `days` Moscow days. */
function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** The Moscow day `days` days from today, as the card shows it: "12 ноября". */
function moscowDayFromToday(days: number) {
  const [year, month, day] = toMoscowInput(new Date()).date.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return formatDay(date.toISOString().slice(0, 10));
}

/** Today by Moscow clocks, as a note shows its date: "5 ноября 2026 г.". */
function moscowToday() {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date());
}

/**
 * A contact with the frequency whose last note was `days` days ago, or who has no notes and got
 * the frequency `days` days ago when `days` is given as `{ noNotesFor }`.
 */
async function makeContact(
  database: PostgresJsDatabase,
  name: string,
  frequency: ContactFrequency | null,
  last: { notedDaysAgo: number } | { noNotesFor: number } | null = null,
) {
  const setAt =
    frequency === null
      ? null
      : last && "noNotesFor" in last
        ? daysAgo(last.noNotesFor)
        : daysAgo(1000);
  const [contact] = await database
    .insert(contacts)
    .values({ name, contactFrequency: frequency, contactFrequencySetAt: setAt })
    .returning({ id: contacts.id });
  if (last && "notedDaysAgo" in last) {
    await database.insert(notes).values({
      contactId: contact.id,
      body: "Созвонились",
      createdAt: daysAgo(last.notedDaysAgo),
    });
  }
  return contact.id;
}

async function talkedNotes(database: PostgresJsDatabase, contactId: number) {
  return database
    .select()
    .from(notes)
    .where(and(eq(notes.contactId, contactId), eq(notes.body, "Пообщались")));
}

test("a frequency chosen for a new contact is in its card, the same in another browser", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя", { exact: true }).fill("Вера Лаптева");
  await dialog.getByLabel("Как часто общаться").click();
  await page.getByRole("option", { name: "Раз в неделю" }).click();
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();

  // A new contact has not talked yet, but its term has not ended: it is not in the block.
  await expect(contactList(page)).toContainText("Вера Лаптева");
  await expect(keepInTouch(page)).toBeHidden();

  const expected = `Раз в неделю · связаться до ${moscowDayFromToday(7)}`;
  await contactList(page)
    .getByRole("link", { name: /Вера Лаптева/ })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Вера Лаптева");
  await expect(frequencyLine(page)).toContainText(expected);
  const cardUrl = page.url();

  const otherBrowser = await browser.newContext({ baseURL });
  try {
    const other = await otherBrowser.newPage();
    await other.goto(cardUrl);
    await expect(frequencyLine(other)).toContainText(expected);
  } finally {
    await otherBrowser.close();
  }
});

test("the block shows whose term has ended, the longest overdue first", async ({
  page,
  database,
}) => {
  // Олег's year ended 35 days ago, Иван's month about 15, Анна's week 3 days ago.
  await makeContact(database, "Анна", "week", { notedDaysAgo: 10 });
  await makeContact(database, "Глеб", "week", { notedDaysAgo: 3 });
  await makeContact(database, "Дина", null, { notedDaysAgo: 500 });
  await makeContact(database, "Иван", "month", { notedDaysAgo: 45 });
  await makeContact(database, "Олег", "year", { noNotesFor: 400 });

  await page.goto("/");

  await test.step("three contacts in the block, the longest overdue on top", async () => {
    await expect(keepInTouch(page).getByRole("heading")).toHaveText(/^Пора связаться\s*3$/);
    await expect(keepInTouchRows(page)).toHaveText([
      /Олег\s*раз в год · ещё не общались/,
      /Иван\s*раз в месяц · не общались 45 дней/,
      /Анна\s*раз в неделю · не общались 10 дней/,
    ]);
    // Every contact is still in the list under the block.
    await expect(contactList(page).getByRole("listitem")).toHaveCount(5);
  });

  await test.step("a search hides the block, clearing it brings the block back", async () => {
    const search = page.getByRole("searchbox", { name: /Поиск/ });
    await search.fill("Иван");
    await expect(contactList(page).getByRole("listitem")).toHaveCount(1);
    await expect(keepInTouch(page)).toBeHidden();

    await search.fill("");
    await expect(keepInTouchRows(page)).toHaveCount(3);
  });

  await test.step("a row opens the card of the contact", async () => {
    await keepInTouchRow(page, "Иван").getByRole("link").click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Иван");
    await expect(frequencyLine(page)).toContainText("Раз в месяц · пора связаться");
  });
});

test("«Пообщались» in the block takes the contact out of it", async ({ page, database }) => {
  const anna = await makeContact(database, "Анна", "week", { notedDaysAgo: 10 });
  const boris = await makeContact(database, "Борис", "week", { notedDaysAgo: 9 });
  await makeContact(database, "Вера", "week", { notedDaysAgo: 8 });

  await page.goto("/");
  await expect(keepInTouchRows(page)).toHaveText([/Анна/, /Борис/, /Вера/]);

  await test.step("a double click marks only the contact clicked", async () => {
    // The first click takes Анна's row away and Борис's row moves up under the pointer: the
    // second click must not mark Борис.
    await keepInTouchRow(page, "Анна").getByRole("checkbox", { name: "Пообщались" }).dblclick();

    await expect(keepInTouchRows(page)).toHaveText([/Борис/, /Вера/]);
    await expect(keepInTouch(page).getByRole("heading")).toHaveText(/^Пора связаться\s*2$/);

    // Saved, not only hidden: after a reload the block comes from the server again.
    await page.reload();
    await expect(keepInTouchRows(page)).toHaveText([/Борис/, /Вера/]);
    expect(await talkedNotes(database, anna)).toHaveLength(1);
    expect(await talkedNotes(database, boris)).toHaveLength(0);
  });

  await test.step("the card has the note «Пообщались» on top, with today's date", async () => {
    await contactList(page).getByRole("link", { name: /Анна/ }).click();
    const latest = noteList(page).getByRole("listitem").first();
    await expect(latest).toContainText("Пообщались");
    await expect(latest).toContainText(moscowToday());
    await expect(frequencyLine(page)).toContainText(
      `Раз в неделю · связаться до ${moscowDayFromToday(7)}`,
    );
    await page.goBack();
  });

  await test.step("once the last one is marked, the block is gone", async () => {
    await keepInTouchRow(page, "Борис").getByRole("checkbox", { name: "Пообщались" }).click();
    await expect(keepInTouchRows(page)).toHaveText([/Вера/]);
    await keepInTouchRow(page, "Вера").getByRole("checkbox", { name: "Пообщались" }).click();

    await expect(keepInTouch(page)).toBeHidden();
    await expect(contactList(page).getByRole("listitem")).toHaveCount(3);
    await page.reload();
    await expect(contactList(page).getByRole("listitem")).toHaveCount(3);
    await expect(keepInTouch(page)).toBeHidden();
  });
});

test("«Пообщались» and a note in the card start the term again", async ({ page, database }) => {
  const ivan = await makeContact(database, "Иван", "week", { notedDaysAgo: 10 });
  const anna = await makeContact(database, "Анна", "week", { notedDaysAgo: 10 });
  const boris = await makeContact(database, "Борис", null);
  const nextWeek = `Раз в неделю · связаться до ${moscowDayFromToday(7)}`;

  await test.step("«Пообщались» in the card, pressed twice", async () => {
    await page.goto(`/contacts/${ivan}`);
    await expect(frequencyLine(page)).toContainText("Раз в неделю · пора связаться");

    await page.getByRole("button", { name: "Пообщались" }).dblclick();

    await expect(frequencyLine(page)).toContainText(nextWeek);
    await expect(noteList(page).getByRole("listitem").first()).toContainText("Пообщались");
    expect(await talkedNotes(database, ivan)).toHaveLength(1);
  });

  await test.step("a note written in the card", async () => {
    await page.goto(`/contacts/${anna}`);
    await expect(frequencyLine(page)).toContainText("Раз в неделю · пора связаться");

    await page.getByRole("textbox", { name: "Новая заметка" }).fill("Поздравил с днём рождения");
    await page.getByRole("button", { name: "Сохранить заметку" }).click();

    await expect(frequencyLine(page)).toContainText(nextWeek);
  });

  await test.step("neither is in the block any more", async () => {
    await page.goto("/");
    await expect(contactList(page).getByRole("listitem")).toHaveCount(3);
    await expect(keepInTouch(page)).toBeHidden();
  });

  await test.step("a contact without a frequency has no «Пообщались»", async () => {
    await page.goto(`/contacts/${boris}`);
    await expect(frequencyLine(page)).toHaveText("не указано");
    await expect(page.getByRole("button", { name: "Пообщались" })).toHaveCount(0);
  });
});

test("the block shows five at first and the rest on «Показать всех»", async ({
  page,
  database,
}) => {
  // "Контакт 01" is the longest overdue, "Контакт 12" the least.
  for (let number = 1; number <= 12; number++) {
    const name = `Контакт ${String(number).padStart(2, "0")}`;
    await makeContact(database, name, "week", { notedDaysAgo: 20 - number });
  }
  const names = (from: number, to: number) =>
    Array.from(
      { length: to - from + 1 },
      (_, index) => new RegExp(`Контакт ${String(from + index).padStart(2, "0")}`),
    );

  await page.goto("/");

  await expect(keepInTouchRows(page)).toHaveText(names(1, 5));
  await page.getByRole("button", { name: "Показать всех (12)" }).click();
  await expect(keepInTouchRows(page)).toHaveText(names(1, 12));

  await test.step("a mark keeps the block open", async () => {
    await keepInTouchRow(page, "Контакт 07").getByRole("checkbox", { name: "Пообщались" }).click();

    await expect(keepInTouchRows(page)).toHaveText([...names(1, 6), ...names(8, 12)]);
    await expect(keepInTouch(page).getByRole("heading")).toHaveText(/^Пора связаться\s*11$/);
    await expect(page.getByRole("button", { name: "Свернуть" })).toBeVisible();
  });

  await page.getByRole("button", { name: "Свернуть" }).click();
  await expect(keepInTouchRows(page)).toHaveText(names(1, 5));

  await test.step("after a reload the block is folded again", async () => {
    await page.getByRole("button", { name: "Показать всех (11)" }).click();
    await page.reload();
    await expect(keepInTouchRows(page)).toHaveText(names(1, 5));
    await expect(page.getByRole("button", { name: "Показать всех (11)" })).toBeVisible();
  });
});

test("a changed frequency starts the term again, a removed one takes the contact out", async ({
  page,
  database,
}) => {
  const ivan = await makeContact(database, "Иван", "month", { noNotesFor: 10 });

  async function chooseFrequency(label: string) {
    await page.getByRole("button", { name: "Изменить", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Изменить контакт" });
    await dialog.getByLabel("Как часто общаться").click();
    await page.getByRole("option", { name: label }).click();
    await dialog.getByRole("button", { name: "Сохранить" }).click();
    await expect(dialog).toBeHidden();
  }

  await page.goto(`/contacts/${ivan}`);
  await expect(frequencyLine(page)).toContainText("Раз в месяц · связаться до");

  await test.step("once a month → once a week: a week from today", async () => {
    await chooseFrequency("Раз в неделю");
    await expect(frequencyLine(page)).toContainText(
      `Раз в неделю · связаться до ${moscowDayFromToday(7)}`,
    );
  });

  await test.step("no frequency: «не указано», never in the block", async () => {
    // Overdue first, so the block would show the contact if the frequency stayed.
    await database
      .update(contacts)
      .set({ contactFrequencySetAt: daysAgo(30) })
      .where(eq(contacts.id, ivan));
    await page.goto("/");
    await expect(keepInTouchRows(page)).toHaveText([/Иван/]);

    await keepInTouchRow(page, "Иван").getByRole("link").click();
    await chooseFrequency("Не задано");

    await expect(frequencyLine(page)).toHaveText("не указано");
    await expect(page.getByRole("button", { name: "Пообщались" })).toHaveCount(0);
    await page.goto("/");
    await expect(contactList(page)).toContainText("Иван");
    await expect(keepInTouch(page)).toBeHidden();
  });
});

test("a mark not saved for lack of connection keeps the contact due", async ({
  page,
  context,
  database,
}) => {
  const ivan = await makeContact(database, "Иван", "week", { notedDaysAgo: 10 });

  await test.step("in the block", async () => {
    await page.goto("/");
    await expect(keepInTouchRows(page)).toHaveText([/Иван/]);

    await context.setOffline(true);
    await keepInTouchRow(page, "Иван").getByRole("checkbox", { name: "Пообщались" }).click();

    await expect(keepInTouchRow(page, "Иван").getByRole("alert")).toHaveText(ERROR_MESSAGE);
    await expect(keepInTouch(page).getByRole("heading")).toHaveText(/^Пора связаться\s*1$/);
    await context.setOffline(false);
  });

  await test.step("in the card", async () => {
    await page.goto(`/contacts/${ivan}`);
    await expect(frequencyLine(page)).toContainText("Раз в неделю · пора связаться");

    await context.setOffline(true);
    await page.getByRole("button", { name: "Пообщались" }).click();

    await expect(page.getByRole("alert").filter({ hasText: ERROR_MESSAGE })).toBeVisible();
    await expect(frequencyLine(page)).toContainText("Раз в неделю · пора связаться");
    await context.setOffline(false);
  });

  expect(await talkedNotes(database, ivan)).toHaveLength(0);
});
