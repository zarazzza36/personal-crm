import { describe, expect, it } from "vitest";

import { contactsUrl, parseGroupId } from "./contact-list";

describe("contactsUrl", () => {
  it("is the plain list address with neither a query nor a group", () => {
    expect(contactsUrl({ query: "", groupId: null })).toBe("/");
  });

  it("has only the query", () => {
    expect(contactsUrl({ query: "иван", groupId: null })).toBe("/?q=%D0%B8%D0%B2%D0%B0%D0%BD");
  });

  it("has only the group", () => {
    expect(contactsUrl({ query: "", groupId: 12 })).toBe("/?group=12");
  });

  // Scenario "Фильтр вместе с поиском": the query stays when a group is chosen
  it("keeps the query when a group is chosen", () => {
    expect(contactsUrl({ query: "иван", groupId: 12 })).toBe("/?q=%D0%B8%D0%B2%D0%B0%D0%BD&group=12");
  });

  // Scenario "Сняли группу при запросе": the query stays when the group is unchosen
  it("keeps the query when the group is taken off", () => {
    expect(contactsUrl({ query: "иван", groupId: null })).toBe("/?q=%D0%B8%D0%B2%D0%B0%D0%BD");
  });

  // Scenario "Очистили поиск": the group stays when the query is cleared or changed
  it("keeps the group when the query is cleared", () => {
    expect(contactsUrl({ query: "", groupId: 12 })).toBe("/?group=12");
  });

  it("keeps the group when the query changes", () => {
    expect(contactsUrl({ query: "пётр", groupId: 12 })).toBe("/?q=%D0%BF%D1%91%D1%82%D1%80&group=12");
  });

  it("escapes what would break the address", () => {
    expect(contactsUrl({ query: "5 тонн & 10%", groupId: 3 })).toBe(
      "/?q=5%20%D1%82%D0%BE%D0%BD%D0%BD%20%26%2010%25&group=3",
    );
  });
});

describe("parseGroupId", () => {
  it("takes a whole positive number", () => {
    expect(parseGroupId("12")).toBe(12);
    expect(parseGroupId("1")).toBe(1);
  });

  // Scenario "Группы из адреса нет" starts here: anything else is no group at all
  it.each([undefined, "", "0", "-1", "1.5", "abc", "12abc", " 12", "012", "1e3", "12345678901"])(
    "takes nothing from %j",
    (value) => {
      expect(parseGroupId(value)).toBeNull();
    },
  );
});
