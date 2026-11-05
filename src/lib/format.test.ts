import { afterEach, describe, expect, it, vi } from "vitest";

import { formatContactCount, formatDay, formatDays, formatNumber } from "./format";

describe("formatContactCount", () => {
  // Scenario "Склонение числа контактов"
  it.each([
    [1, "1 контакт"],
    [3, "3 контакта"],
    [5, "5 контактов"],
    [21, "21 контакт"],
  ])("says %i as %j", (count, expected) => {
    expect(formatContactCount(count)).toBe(expected);
  });

  it.each([
    [0, "0 контактов"],
    [2, "2 контакта"],
    [4, "4 контакта"],
    [11, "11 контактов"],
    [12, "12 контактов"],
    [14, "14 контактов"],
    [22, "22 контакта"],
    [25, "25 контактов"],
    [101, "101 контакт"],
    [111, "111 контактов"],
  ])("also says %i as %j", (count, expected) => {
    expect(formatContactCount(count)).toBe(expected);
  });

  it("splits thousands the way the rest of the app does", () => {
    expect(formatContactCount(1000)).toBe(`${formatNumber(1000)} контактов`);
    expect(formatContactCount(1001)).toBe(`${formatNumber(1001)} контакт`);
  });
});

describe("formatDays", () => {
  // Scenario "Склонение"
  it.each([
    [21, "21 день"],
    [22, "22 дня"],
    [25, "25 дней"],
  ])("says %i as %j", (count, expected) => {
    expect(formatDays(count)).toBe(expected);
  });

  it.each([
    [0, "0 дней"],
    [1, "1 день"],
    [4, "4 дня"],
    [11, "11 дней"],
    [14, "14 дней"],
    [45, "45 дней"],
    [101, "101 день"],
    [111, "111 дней"],
    [730, "730 дней"],
  ])("also says %i as %j", (count, expected) => {
    expect(formatDays(count)).toBe(expected);
  });
});

describe("formatDay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Scenario "Срок ещё не вышел": today is 26 October 2026.
  it("leaves out the year of this year", () => {
    vi.useFakeTimers({ now: new Date("2026-10-26T12:00:00+03:00"), toFake: ["Date"] });
    expect(formatDay("2026-11-15")).toBe("15 ноября");
  });

  // Scenario "Срок в следующем году"
  it("writes the year of another year", () => {
    vi.useFakeTimers({ now: new Date("2026-10-26T12:00:00+03:00"), toFake: ["Date"] });
    expect(formatDay("2027-03-03")).toBe("3 марта 2027 г.");
  });

  it("takes this year by Moscow clocks, where the new year comes earlier than in UTC", () => {
    // 31 December 22:30 in UTC is already 1 January 2027 in Moscow.
    vi.useFakeTimers({ now: new Date("2026-12-31T22:30:00Z"), toFake: ["Date"] });
    expect(formatDay("2027-01-07")).toBe("7 января");
    expect(formatDay("2026-12-31")).toBe("31 декабря 2026 г.");
  });

  it("never moves the day, whatever the time zone of the device", () => {
    vi.useFakeTimers({ now: new Date("2026-10-26T12:00:00+03:00"), toFake: ["Date"] });
    expect(formatDay("2026-11-01")).toBe("1 ноября");
    expect(formatDay("2026-11-30")).toBe("30 ноября");
  });
});
