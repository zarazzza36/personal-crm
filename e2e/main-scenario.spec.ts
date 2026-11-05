// The main scenario of specs/01-продуктовая-идея.md: open the app and see every contact, add one,
// find it by name, write a note after a talk; the note stays in the card, and another browser
// opening the same address sees the same contacts.

import type { Page } from "@playwright/test";

import { contacts } from "../src/db/schema";

import { expect, test } from "./fixtures";

const NEW_CONTACT = {
  name: "Вера Лаптева",
  about: "Дизайнер интерфейсов",
  howWeMet: "Учились вместе в университете",
  phone: "+7 000 123-45-67",
  email: "vera@example.com",
};

const NOTE = "Договорились созвониться в пятницу: Вера пришлёт макеты";

const contactList = (page: Page) => page.getByRole("list", { name: "Список контактов" });
const contactsCount = (page: Page) => page.getByTestId("contacts-count");
const noteList = (page: Page) => page.getByRole("list", { name: "Заметки о контакте" });

test("a contact added, found and noted is kept, the same in another browser", async ({
  page,
  browser,
  baseURL,
  database,
}) => {
  await database.insert(contacts).values([
    { name: "Анна Смирнова", about: "Соседка по даче" },
    { name: "Борис Котов", about: "Механик" },
  ]);

  await test.step("opened: the list shows every contact", async () => {
    await page.goto("/");

    await expect(contactList(page).getByRole("listitem")).toHaveText([
      /Анна Смирнова/,
      /Борис Котов/,
    ]);
    await expect(contactsCount(page)).toHaveText("Всего: 2");
  });

  await test.step("added a contact: it is in the list", async () => {
    await page.getByRole("button", { name: "Добавить контакт" }).click();
    const dialog = page.getByRole("dialog", { name: "Новый контакт" });
    await dialog.getByLabel("Имя", { exact: true }).fill(NEW_CONTACT.name);
    await dialog.getByLabel("Кто это", { exact: true }).fill(NEW_CONTACT.about);
    await dialog.getByLabel("Откуда знакомы", { exact: true }).fill(NEW_CONTACT.howWeMet);
    await dialog.getByLabel("Телефон", { exact: true }).fill(NEW_CONTACT.phone);
    await dialog.getByLabel("Почта", { exact: true }).fill(NEW_CONTACT.email);
    await dialog.getByRole("button", { name: "Сохранить" }).click();

    await expect(dialog).toBeHidden();
    await expect(contactList(page).getByRole("listitem")).toHaveCount(3);
    await expect(contactList(page)).toContainText(NEW_CONTACT.name);
    await expect(contactsCount(page)).toHaveText("Всего: 3");
  });

  await test.step("found the contact by name and opened the card", async () => {
    await page.getByRole("searchbox", { name: /Поиск/ }).fill("Вера");

    await expect(contactsCount(page)).toHaveText("Найдено: 1 из 3");
    await expect(contactList(page).getByRole("listitem")).toHaveText([
      new RegExp(NEW_CONTACT.name),
    ]);

    await contactList(page)
      .getByRole("link", { name: new RegExp(NEW_CONTACT.name) })
      .click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(NEW_CONTACT.name);
    for (const value of Object.values(NEW_CONTACT)) {
      await expect(page.getByRole("main")).toContainText(value);
    }
    await expect(page.getByText("Заметок пока нет")).toBeVisible();
  });

  await test.step("wrote a note after the talk: it is saved in the card", async () => {
    const noteField = page.getByRole("textbox", { name: "Новая заметка" });
    await noteField.fill(NOTE);
    await page.getByRole("button", { name: "Сохранить заметку" }).click();

    await expect(noteList(page).getByRole("listitem")).toHaveText([new RegExp(NOTE)]);
    await expect(noteField).toHaveValue("");

    // Not just shown: after a reload the card comes from the server again.
    await page.reload();
    await expect(noteList(page).getByRole("listitem")).toHaveText([new RegExp(NOTE)]);
  });

  await test.step("another browser at the same address: the same contacts and the note", async () => {
    // A context of its own: no cookies, storage or cache of the first one, as another browser.
    const otherBrowser = await browser.newContext({ baseURL });
    try {
      const other = await otherBrowser.newPage();
      await other.goto("/");

      await expect(contactList(other).getByRole("listitem")).toHaveText([
        /Анна Смирнова/,
        /Борис Котов/,
        new RegExp(NEW_CONTACT.name),
      ]);
      await expect(contactsCount(other)).toHaveText("Всего: 3");

      await contactList(other)
        .getByRole("link", { name: new RegExp(NEW_CONTACT.name) })
        .click();
      await expect(other.getByRole("heading", { level: 1 })).toHaveText(NEW_CONTACT.name);
      await expect(noteList(other).getByRole("listitem")).toHaveText([new RegExp(NOTE)]);
    } finally {
      await otherBrowser.close();
    }
  });
});
