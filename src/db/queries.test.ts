import { describe, expect, it } from "vitest";

import { addAllToGroup, addToGroup, makeContact, makeContacts, makeGroup } from "@/test/factories";

import { deleteGroup, getGroup } from "./groups";
import { countContacts, getContactListItem, listContactsPage, searchContacts } from "./queries";

describe("the groups of a contact in the list", () => {
  // Scenario "Контакт в двух группах"
  it("gives the names of the groups in alphabetical order", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    await makeGroup("Друзья");
    const ivan = await makeContact("Иван");
    await addToGroup(ivan, tennis);
    await addToGroup(ivan, family);

    const { items } = await listContactsPage(null, 50);

    expect(items).toHaveLength(1);
    expect(items[0].groupNames).toEqual(["Семья", "Теннис"]);
  });

  it("puts a contact in the list once, however many groups it is in", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    for (const name of ["Иван", "Пётр", "Анна"]) {
      const id = await makeContact(name);
      await addToGroup(id, tennis);
      await addToGroup(id, family);
    }

    const { items } = await listContactsPage(null, 50);

    expect(items.map((item) => item.name)).toEqual(["Анна", "Иван", "Пётр"]);
  });

  // Scenario "Контакт без групп в списке"
  it("gives an empty list for a contact without groups", async () => {
    await makeGroup("Теннис");
    await makeContact("Иван");

    const { items } = await listContactsPage(null, 50);

    expect(items[0].groupNames).toEqual([]);
  });

  it("gives each contact its own groups", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    await addToGroup(await makeContact("Анна"), tennis);
    await makeContact("Борис");
    await addToGroup(await makeContact("Вера"), family);

    const { items } = await listContactsPage(null, 50);

    expect(items.map((item) => [item.name, item.groupNames])).toEqual([
      ["Анна", ["Теннис"]],
      ["Борис", []],
      ["Вера", ["Семья"]],
    ]);
  });

  // Scenario "В найденном поиском"
  it("is there in the search results", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    const ivan = await makeContact("Иван Петров");
    await makeContact("Пётр Сидоров");
    await addToGroup(ivan, tennis);
    await addToGroup(ivan, family);

    const found = await searchContacts("Иван");

    expect(found.map((item) => [item.name, item.groupNames])).toEqual([
      ["Иван Петров", ["Семья", "Теннис"]],
    ]);
  });

  // Scenario "В подгруженном при прокрутке"
  it("is there in the parts loaded later", async () => {
    const tennis = await makeGroup("Теннис");
    for (const name of ["Анна", "Борис", "Вера", "Глеб"]) {
      await addToGroup(await makeContact(name), tennis);
    }

    const first = await listContactsPage(null, 2);
    const second = await listContactsPage(first.nextCursor, 2);

    expect(second.items.map((item) => [item.name, item.groupNames])).toEqual([
      ["Вера", ["Теннис"]],
      ["Глеб", ["Теннис"]],
    ]);
  });

  // Scenario "Только что добавленный"
  it("is there for the contact that has just been added", async () => {
    const family = await makeGroup("Семья");
    const ivan = await makeContact("Иван");
    await addToGroup(ivan, family);

    const added = await getContactListItem(ivan);

    expect(added?.groupNames).toEqual(["Семья"]);
  });
});

describe("the list filtered by a group", () => {
  // Scenario "Выбрали группу"
  it("gives only the contacts of the group, in alphabetical order, and counts them", async () => {
    const tennis = await makeGroup("Теннис");
    const players = await makeContacts(12, "Игрок");
    await makeContacts(8, "Прохожий");
    await addAllToGroup(players, tennis);

    const { items, nextCursor } = await listContactsPage(null, 50, tennis);

    expect(items.map((item) => item.name)).toEqual(
      Array.from({ length: 12 }, (_, index) => `Игрок ${String(index + 1).padStart(3, "0")}`),
    );
    expect(nextCursor).toBeNull();
    expect(await countContacts(tennis)).toBe(12);
    expect(await countContacts()).toBe(20);
  });

  it("gives all the contacts without a group", async () => {
    const tennis = await makeGroup("Теннис");
    await addAllToGroup(await makeContacts(2, "Игрок"), tennis);
    await makeContacts(3, "Прохожий");

    expect((await listContactsPage(null, 50, null)).items).toHaveLength(5);
    expect((await listContactsPage(null, 50)).items).toHaveLength(5);
  });

  it("still shows every group of the contact, not only the chosen one", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    const ivan = await makeContact("Иван");
    await addToGroup(ivan, tennis);
    await addToGroup(ivan, family);

    const { items } = await listContactsPage(null, 50, tennis);

    expect(items[0].groupNames).toEqual(["Семья", "Теннис"]);
  });

  // Scenario "Большая группа подгружается"
  it("loads a big group part by part, without repeats, all from the group", async () => {
    const friends = await makeGroup("Друзья");
    await addAllToGroup(await makeContacts(120, "Друг"), friends);
    await makeContacts(30, "Чужой");

    const first = await listContactsPage(null, 50, friends);
    const second = await listContactsPage(first.nextCursor, 50, friends);
    const third = await listContactsPage(second.nextCursor, 50, friends);

    expect([first.items.length, second.items.length, third.items.length]).toEqual([50, 50, 20]);
    expect(first.nextCursor).not.toBeNull();
    expect(second.nextCursor).not.toBeNull();
    expect(third.nextCursor).toBeNull();
    const all = [...first.items, ...second.items, ...third.items];
    expect(new Set(all.map((item) => item.id)).size).toBe(120);
    expect(all.every((item) => item.groupNames.includes("Друзья"))).toBe(true);
    expect(all.map((item) => item.name)).toEqual([...all.map((item) => item.name)].sort());
  });

  // Scenario "Поиск внутри группы"
  it("searches only inside the group", async () => {
    const tennis = await makeGroup("Теннис");
    const insideA = await makeContact("Иван Первый");
    const insideB = await makeContact("Иван Второй");
    const inside = await makeContact("Пётр Сидоров");
    await makeContact("Иван Чужой");
    for (const id of [insideA, insideB, inside]) await addToGroup(id, tennis);

    const found = await searchContacts("Иван", tennis);

    expect(found.map((item) => item.name)).toEqual(["Иван Второй", "Иван Первый"]);
    expect((await searchContacts("Иван")).map((item) => item.name)).toHaveLength(3);
  });

  it("finds nobody when nobody in the group fits the query", async () => {
    const tennis = await makeGroup("Теннис");
    await addToGroup(await makeContact("Иван"), tennis);
    await makeContact("Пётр");

    expect(await searchContacts("Пётр", tennis)).toEqual([]);
  });

  it("gives an empty list for a group nobody is in", async () => {
    const analysts = await makeGroup("Аналитики");
    await makeContacts(3);

    expect((await listContactsPage(null, 50, analysts)).items).toEqual([]);
    expect(await countContacts(analysts)).toBe(0);
  });

  // Scenario "Группы из адреса нет": the page finds no group and shows everyone
  it("has no group to filter by once the group is deleted", async () => {
    const tennis = await makeGroup("Теннис");
    await addAllToGroup(await makeContacts(2), tennis);
    await deleteGroup(tennis);

    expect(await getGroup(tennis)).toBeUndefined();
    expect((await listContactsPage(null, 50)).items).toHaveLength(2);
  });
});
