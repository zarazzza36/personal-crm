import type { Page } from "@playwright/test";
import { randomInt, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { contactGroups, contacts, groups, users } from "../src/db/schema";
import { formatDay } from "../src/lib/format";
import { toMoscowInput } from "../src/lib/moscow-time";
import { expect, signIn, test } from "./fixtures";

let userId: string;

test.beforeEach(async ({ page, database }) => {
  const email = `birthday-${randomUUID()}@example.com`;
  await page.context().setExtraHTTPHeaders({
    "x-real-ip": `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
  });
  await signIn(page, email);
  const [user] = await database.select({ id: users.id }).from(users).where(eq(users.email, email));
  userId = user.id;
});

const birthDateLine = (page: Page) =>
  page.locator("dt", { hasText: /^Дата рождения$/ }).locator("xpath=following-sibling::dd[1]");
const upcomingBirthdays = (page: Page) => page.getByRole("region", { name: "Скоро день рождения" });

function moscowDayFromToday(days: number) {
  const today = toMoscowInput(new Date()).date;
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

function birthDateFor(day: string) {
  return `2000-${day.slice(5)}`;
}

async function openNewContact(page: Page, name: string) {
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя", { exact: true }).fill(name);
  return dialog;
}

async function openEditContact(page: Page) {
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  return page.getByRole("dialog", { name: "Изменить контакт" });
}

async function openContactFromList(page: Page, name: string) {
  await page.getByRole("list", { name: "Список контактов" }).getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

test("добавили контакт без даты", async ({ page }) => {
  const dialog = await openNewContact(page, "Контакт без даты");
  await expect(dialog.getByLabel("Дата рождения")).toHaveValue("");
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  await openContactFromList(page, "Контакт без даты");
  await expect(birthDateLine(page)).toHaveText("не указано");
});

test("создали контакт с датой рождения и открыли в другом часовом поясе", async ({
  page,
  browser,
  baseURL,
}) => {
  const dialog = await openNewContact(page, "Контакт с датой");
  const date = dialog.getByLabel("Дата рождения");
  await expect(date).toBeVisible();
  await date.fill("2000-02-29");
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await openContactFromList(page, "Контакт с датой");

  const otherContext = await browser.newContext({
    baseURL,
    timezoneId: "America/Los_Angeles",
    storageState: await page.context().storageState(),
  });
  try {
    const otherPage = await otherContext.newPage();
    await otherPage.goto(page.url());
    await expect(birthDateLine(otherPage)).toHaveText("29 февраля 2000 г.");
    const edit = await openEditContact(otherPage);
    await expect(edit.getByLabel("Дата рождения")).toHaveValue("2000-02-29");
  } finally {
    await otherContext.close();
  }
});

test("изменили сохранённую дату", async ({ page, database }) => {
  const [contact] = await database
    .insert(contacts)
    .values({ userId, name: "Анна", birthDate: "1980-02-29" })
    .returning({ id: contacts.id });
  await page.goto(`/contacts/${contact.id}`);

  const dialog = await openEditContact(page);
  const date = dialog.getByLabel("Дата рождения");
  await expect(date).toHaveValue("1980-02-29");
  await date.fill("1981-01-03");
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  await expect(birthDateLine(page)).toHaveText("3 января 1981 г.");
  const reopened = await openEditContact(page);
  await expect(reopened.getByLabel("Дата рождения")).toHaveValue("1981-01-03");
});

test("порядок ближайших дней рождения и открытие карточки", async ({ page, database }) => {
  const tomorrow = moscowDayFromToday(1);
  const later = moscowDayFromToday(2);
  await database.insert(contacts).values([
    { userId, name: "Борис", birthDate: birthDateFor(later) },
    { userId, name: "Вера", birthDate: birthDateFor(tomorrow) },
    { userId, name: "Алла", birthDate: birthDateFor(later) },
    {
      userId,
      name: "Олег",
      contactFrequency: "week",
      contactFrequencySetAt: new Date("2001-01-01T00:00:00Z"),
    },
  ]);
  await page.goto("/");

  const birthdays = upcomingBirthdays(page);
  await expect(birthdays.getByRole("listitem")).toHaveText([
    `Вера ${formatDay(tomorrow, "never")}`,
    `Алла ${formatDay(later, "never")}`,
    `Борис ${formatDay(later, "never")}`,
  ]);
  await expect(page.getByRole("region", { name: /^Пора связаться/ })).toContainText("Олег");
  await birthdays.getByRole("link", { name: /Вера/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Вера");
});

test("пустой блок ближайших дней рождения скрыт", async ({ page, database }) => {
  await database.insert(contacts).values([
    { userId, name: "Контакт вне окна", birthDate: birthDateFor(moscowDayFromToday(14)) },
    { userId, name: "Старый контакт" },
  ]);
  await page.goto("/");

  await expect(page.getByRole("list", { name: "Список контактов" })).toContainText(
    "Контакт вне окна",
  );
  await expect(upcomingBirthdays(page)).toBeHidden();

  await openContactFromList(page, "Старый контакт");
  const dialog = await openEditContact(page);
  await expect(dialog.getByLabel("Дата рождения")).toHaveValue("");
  await dialog.getByLabel("Кто это").fill("Сохранили другие данные");
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Сохранили другие данные")).toBeVisible();
});

test("поиск скрывает блок ближайших дней рождения и возвращает его после очистки", async ({
  page,
  database,
}) => {
  await database.insert(contacts).values({
    userId,
    name: "Вера",
    birthDate: birthDateFor(moscowDayFromToday(1)),
  });
  await page.goto("/");
  await expect(upcomingBirthdays(page)).toBeVisible();

  const search = page.getByRole("searchbox", { name: /Поиск/ });
  await search.fill("Вера");
  await expect(upcomingBirthdays(page)).toBeHidden();
  await search.fill("");
  await expect(upcomingBirthdays(page)).toBeVisible();
});

test("выбранная группа скрывает блок ближайших дней рождения", async ({ page, database }) => {
  const [contact] = await database
    .insert(contacts)
    .values({ userId, name: "Вера", birthDate: birthDateFor(moscowDayFromToday(1)) })
    .returning({ id: contacts.id });
  const [group] = await database
    .insert(groups)
    .values({ userId, name: "Семья" })
    .returning({ id: groups.id });
  await database.insert(contactGroups).values({ contactId: contact.id, groupId: group.id });
  await page.goto("/");
  await expect(upcomingBirthdays(page)).toBeVisible();

  const groupFilter = page.getByRole("navigation", { name: "Фильтр по группе" });
  await groupFilter.getByRole("link", { name: "Семья" }).click();
  await expect(upcomingBirthdays(page)).toBeHidden();
  await groupFilter.getByRole("link", { name: "Семья" }).click();
  await expect(upcomingBirthdays(page)).toBeVisible();
});

test("очистили дату рождения и убрали контакт из блока", async ({ page, database }) => {
  await database.insert(contacts).values({
    userId,
    name: "Вера",
    birthDate: birthDateFor(moscowDayFromToday(1)),
  });
  await page.goto("/");
  await upcomingBirthdays(page).getByRole("link", { name: /Вера/ }).click();

  const dialog = await openEditContact(page);
  await dialog.getByLabel("Дата рождения").fill("");
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(birthDateLine(page)).toHaveText("не указано");

  const reopened = await openEditContact(page);
  await expect(reopened.getByLabel("Дата рождения")).toHaveValue("");
  await reopened.getByRole("button", { name: "Отмена" }).click();
  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(page.getByRole("list", { name: "Список контактов" })).toContainText("Вера");
  await expect(upcomingBirthdays(page)).toBeHidden();
});

test("новый контакт сразу появляется в блоке ближайших дней рождения", async ({ page }) => {
  const dialog = await openNewContact(page, "Вера");
  await dialog.getByLabel("Дата рождения").fill(birthDateFor(moscowDayFromToday(1)));
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  await expect(upcomingBirthdays(page).getByRole("link", { name: /Вера/ })).toBeVisible();
});
