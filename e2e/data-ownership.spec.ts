import type { Page } from "@playwright/test";
import { randomInt, randomUUID } from "node:crypto";

import { expect, signIn, test } from "./fixtures";

const list = (page: Page) => page.getByRole("list", { name: "Список контактов" });
const notes = (page: Page) => page.getByRole("list", { name: "Заметки о контакте" });

async function createContact(page: Page, name: string, detail: string, note: string) {
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя", { exact: true }).fill(name);
  await dialog.getByLabel("Кто это", { exact: true }).fill(detail);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();
  await list(page)
    .getByRole("link", { name: new RegExp(name) })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  const url = page.url();
  await page.getByRole("textbox", { name: "Новая заметка" }).fill(note);
  await page.getByRole("button", { name: "Сохранить заметку" }).click();
  await expect(notes(page)).toContainText(note);
  return url;
}

test("пользователи видят только свои контакты и заметки", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const ip = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`;
  const aContext = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-real-ip": ip } });
  const bContext = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-real-ip": ip } });
  const a = await aContext.newPage();
  const b = await bContext.newPage();
  const id = randomUUID();
  const alice = { name: "Анна Изоляция", detail: "Данные Анны", note: "Заметка Анны" };
  const boris = { name: "Борис Изоляция", detail: "Данные Бориса", note: "Заметка Бориса" };

  try {
    await signIn(a, `a-${id}@example.com`);
    await signIn(b, `b-${id}@example.com`);
    const aUrl = await createContact(a, alice.name, alice.detail, alice.note);
    const bUrl = await createContact(b, boris.name, boris.detail, boris.note);

    for (const [page, own, foreign, ownUrl, foreignUrl] of [
      [a, alice, boris, aUrl, bUrl],
      [b, boris, alice, bUrl, aUrl],
    ] as const) {
      for (let attempt = 0; attempt < 2; attempt++) {
        await page.goto("/");
        if (attempt) await page.reload();
        await expect(list(page)).toContainText(own.name);
        await expect(list(page)).not.toContainText(foreign.name);
        const search = page.getByRole("searchbox", { name: /Поиск/ });
        await search.fill(own.name);
        await expect(list(page)).toContainText(own.name);
        await search.fill(foreign.name);
        await expect(page.getByTestId("contacts-count")).toContainText("Найдено: 0");
        await expect(list(page).getByRole("listitem")).toHaveCount(0);
        if (attempt) {
          await page.reload();
          await expect(page.getByTestId("contacts-count")).toContainText("Найдено: 0");
          await expect(list(page).getByRole("listitem")).toHaveCount(0);
        }
        await page.goto(ownUrl);
        if (attempt) await page.reload();
        await expect(page.getByRole("main")).toContainText(own.name);
        await expect(notes(page)).toContainText(own.note);
        await page.goto(foreignUrl);
        if (attempt) await page.reload();
        await expect(page.getByText("Контакт не найден")).toBeVisible();
        for (const value of Object.values(foreign)) {
          await expect(page.locator("body")).not.toContainText(value);
        }
      }
    }
  } finally {
    await aContext.close();
    await bContext.close();
  }
});
