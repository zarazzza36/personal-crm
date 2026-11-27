import { beforeEach, expect, it } from "vitest";

import { db } from "@/db";
import { users } from "@/db/schema";
import { makeContact } from "@/test/factories";
import { makeTestUser, TEST_USER_ID } from "@/test/test-user";

import { listUpcomingBirthdays } from "./queries";

beforeEach(makeTestUser);

function upcoming(at: string) {
  return listUpcomingBirthdays(TEST_USER_ID, new Date(at));
}

it("включает сегодняшний и шестой день, исключает остальные и пустую дату", async () => {
  await makeContact("Вчера", { birthDate: "1980-11-09" });
  const today = await makeContact("Сегодня", { birthDate: "1980-11-10" });
  const last = await makeContact("Через шесть дней", { birthDate: "1980-11-16" });
  await makeContact("Через неделю", { birthDate: "1980-11-17" });
  await makeContact("Без даты");

  expect(await upcoming("2026-11-10T12:00:00+03:00")).toEqual([
    { id: today, name: "Сегодня", day: "2026-11-10" },
    { id: last, name: "Через шесть дней", day: "2026-11-16" },
  ]);
});

it("показывает декабрьские и январские дни рождения в календарном порядке", async () => {
  await makeContact("Андрей", { birthDate: "1980-01-02" });
  await makeContact("Борис", { birthDate: "1980-12-30" });
  await makeContact("Вера", { birthDate: "1980-01-05" });

  expect((await upcoming("2026-12-29T12:00:00+03:00")).map(({ day }) => day)).toEqual([
    "2026-12-30",
    "2027-01-02",
  ]);
});

it("переносит 29 февраля на 28 февраля в невисокосном году", async () => {
  const id = await makeContact("Анна", { birthDate: "2000-02-29" });

  expect(await upcoming("2027-02-28T12:00:00+03:00")).toEqual([
    { id, name: "Анна", day: "2027-02-28" },
  ]);
});

it("показывает 29 февраля в високосном году", async () => {
  const id = await makeContact("Анна", { birthDate: "2000-02-29" });

  expect(await upcoming("2028-02-28T12:00:00+03:00")).toEqual([
    { id, name: "Анна", day: "2028-02-29" },
  ]);
});

it("переключает окно в полночь по Москве", async () => {
  await makeContact("Вчера", { birthDate: "1980-11-09" });
  await makeContact("Через шесть дней", { birthDate: "1980-11-16" });

  expect((await upcoming("2026-11-09T20:59:59Z")).map(({ day }) => day)).toEqual(["2026-11-09"]);
  expect((await upcoming("2026-11-09T21:00:00Z")).map(({ day }) => day)).toEqual(["2026-11-16"]);
});

it("учитывает только контакты вошедшего пользователя", async () => {
  const anotherUser = "another-user";
  await db.insert(users).values({ id: anotherUser, name: "", email: "another@example.com" });
  await makeContact("Чужой контакт", { userId: anotherUser, birthDate: "1990-11-10" });
  const id = await makeContact("Свой контакт", { birthDate: "1980-11-10" });

  expect(await upcoming("2026-11-10T12:00:00+03:00")).toEqual([
    { id, name: "Свой контакт", day: "2026-11-10" },
  ]);
});
