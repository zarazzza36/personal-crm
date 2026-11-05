import { describe, expect, it } from "vitest";

import { formatContactCount, formatNumber } from "./format";

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
