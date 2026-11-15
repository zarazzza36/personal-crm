import { randomUUID, randomInt } from "node:crypto";

import { expect, signIn, test } from "./fixtures";

test("вход обязателен, выход действует только на текущем устройстве", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const email = `login-${randomUUID()}@example.com`;
  const ip = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`;
  await page.context().setExtraHTTPHeaders({ "x-real-ip": ip });
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("ДЛЯ ЛОГИСТОВ")).toBeVisible();
  await signIn(page, email);
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("Добавьте первый контакт")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.getByText(email)).toHaveCSS("text-overflow", "ellipsis");
  await expect(page.getByRole("button", { name: "Выйти" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  const otherContext = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-real-ip": ip } });
  try {
    const other = await otherContext.newPage();
    await signIn(other, email);
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === "/login");
    await expect(page.getByLabel("Почта")).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await other.reload();
    await expect(other.getByText(email)).toBeVisible();
    await expect(other.getByRole("button", { name: "Добавить контакт" })).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test("неверная и устаревшая ссылка показывают страницу запроса новой", async ({ page }) => {
  await page.goto(
    "/api/auth/magic-link/verify?token=invalid&errorCallbackURL=%2Flogin%2Flink-expired",
  );
  await expect(
    page.getByRole("heading", { name: "Ссылка устарела, запросите новую" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Получить новую ссылку" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("неверная почта показывает понятную ошибку", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Почта").fill("это не почта");
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Проверьте адрес почты");
});
