import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { addToGroup, makeContact, makeGroup } from "@/test/factories";

import {
  addContactToNewGroup,
  createGroup,
  deleteGroup,
  findOrCreateGroup,
  getGroup,
  listContactGroups,
  listGroups,
  renameGroup,
  setContactGroupMembership,
  setContactGroups,
} from "./groups";
import { contactGroups, contacts, groups } from "./schema";

describe("createGroup", () => {
  // Scenario "Создали группу"
  it("creates a group without contacts", async () => {
    const id = await makeGroup("Теннис");

    expect(await listGroups()).toEqual([{ id, name: "Теннис", contactCount: 0 }]);
  });

  it("saves the name as typed, without the spaces around it", async () => {
    const id = await makeGroup("  Большой Теннис  ");

    expect(await getGroup(id)).toEqual({ id, name: "Большой Теннис" });
  });

  // Scenario "Такая группа уже есть"
  it("refuses a name that is taken, whatever the case", async () => {
    await makeGroup("Теннис");

    expect(await createGroup("теннис")).toEqual({ ok: false, error: "Такая группа уже есть" });
    expect(await createGroup("ТЕННИС")).toEqual({ ok: false, error: "Такая группа уже есть" });
    expect((await listGroups()).map((group) => group.name)).toEqual(["Теннис"]);
  });

  // Scenarios "Пустое название" and "Слишком длинное название"
  it("refuses an empty name and a name over 50 characters", async () => {
    expect(await createGroup("   ")).toEqual({ ok: false, error: "Укажите название группы" });
    expect(await createGroup("а".repeat(51))).toEqual({
      ok: false,
      error: "Не длиннее 50 символов",
    });
    expect(await listGroups()).toEqual([]);
  });
});

describe("listGroups", () => {
  // Scenario "Групп ещё нет"
  it("is empty when there are no groups", async () => {
    expect(await listGroups()).toEqual([]);
  });

  // Scenario "Алфавит"
  it("lists the groups in Russian alphabetical order, whatever the case", async () => {
    await makeGroup("теннис");
    await makeGroup("Семья");
    await makeGroup("Аналитики");

    expect((await listGroups()).map((group) => group.name)).toEqual([
      "Аналитики",
      "Семья",
      "теннис",
    ]);
  });

  it("counts the contacts of each group", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    await makeGroup("Аналитики");
    const ivan = await makeContact("Иван");
    const petr = await makeContact("Пётр");
    await addToGroup(ivan, tennis);
    await addToGroup(petr, tennis);
    await addToGroup(ivan, family);

    expect(await listGroups()).toEqual([
      { id: expect.any(Number), name: "Аналитики", contactCount: 0 },
      { id: family, name: "Семья", contactCount: 1 },
      { id: tennis, name: "Теннис", contactCount: 2 },
    ]);
  });
});

describe("getGroup", () => {
  it("gives the group", async () => {
    const id = await makeGroup("Теннис");

    expect(await getGroup(id)).toEqual({ id, name: "Теннис" });
  });

  it("gives nothing when there is no such group", async () => {
    expect(await getGroup(12345)).toBeUndefined();
  });
});

describe("renameGroup", () => {
  // Scenario "Переименовали"
  it("renames the group and keeps its contacts", async () => {
    const tennis = await makeGroup("Теннис");
    await addToGroup(await makeContact("Иван"), tennis);
    await addToGroup(await makeContact("Пётр"), tennis);

    expect(await renameGroup(tennis, "Большой теннис")).toEqual({ ok: true, id: tennis });

    expect(await listGroups()).toEqual([{ id: tennis, name: "Большой теннис", contactCount: 2 }]);
  });

  it("saves the new name without the spaces around it", async () => {
    const id = await makeGroup("Теннис");

    await renameGroup(id, "  Большой теннис ");

    expect(await getGroup(id)).toEqual({ id, name: "Большой теннис" });
  });

  // Scenario "Новое название уже занято"
  it("refuses a name another group has, whatever the case, and keeps the old name", async () => {
    await makeGroup("Семья");
    const friends = await makeGroup("Друзья");

    expect(await renameGroup(friends, "семья")).toEqual({
      ok: false,
      error: "Такая группа уже есть",
    });

    expect(await getGroup(friends)).toEqual({ id: friends, name: "Друзья" });
  });

  // Scenario "Сменили только регистр"
  it("lets a group change only the case of its own name", async () => {
    const id = await makeGroup("теннис");

    expect(await renameGroup(id, "Теннис")).toEqual({ ok: true, id });

    expect(await getGroup(id)).toEqual({ id, name: "Теннис" });
  });

  it("lets a group keep its name when it is saved unchanged", async () => {
    const id = await makeGroup("Теннис");

    expect(await renameGroup(id, "Теннис")).toEqual({ ok: true, id });
  });

  // Scenario "Пустое новое название"
  it("refuses an empty name and a name over 50 characters, and keeps the old name", async () => {
    const id = await makeGroup("Теннис");

    expect(await renameGroup(id, "   ")).toEqual({ ok: false, error: "Укажите название группы" });
    expect(await renameGroup(id, "а".repeat(51))).toEqual({
      ok: false,
      error: "Не длиннее 50 символов",
    });

    expect(await getGroup(id)).toEqual({ id, name: "Теннис" });
  });

  it("fails loudly when the group is gone, for example deleted in another tab", async () => {
    await expect(renameGroup(12345, "Теннис")).rejects.toThrow("Group 12345 not found");
  });
});

describe("deleteGroup", () => {
  // Scenario "Удалили группу"
  it("deletes the group and its links, and leaves the contacts", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    const ivan = await makeContact("Иван");
    const petr = await makeContact("Пётр");
    await addToGroup(ivan, tennis);
    await addToGroup(petr, tennis);
    await addToGroup(ivan, family);

    await deleteGroup(tennis);

    expect(await getGroup(tennis)).toBeUndefined();
    expect((await listGroups()).map((group) => group.name)).toEqual(["Семья"]);
    // Both contacts are where they were; only their links to the deleted group are gone.
    expect(await db.$count(contacts)).toBe(2);
    expect(await db.$count(contactGroups)).toBe(1);
    // The other group is untouched.
    expect((await listGroups())[0].contactCount).toBe(1);
  });

  it("does nothing when the group is already gone, for example deleted in another tab", async () => {
    const id = await makeGroup("Теннис");
    await deleteGroup(id);

    await expect(deleteGroup(id)).resolves.toBeUndefined();
  });

  it("lets the name be used again", async () => {
    const id = await makeGroup("Теннис");
    await deleteGroup(id);

    expect(await createGroup("Теннис")).toMatchObject({ ok: true });
  });
});

describe("the number of contacts of a group", () => {
  // Scenario "Число меняется вместе с контактами"
  it("goes down when a contact is deleted for good", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");
    const petr = await makeContact("Пётр");
    await addToGroup(ivan, tennis);
    await addToGroup(petr, tennis);
    expect((await listGroups())[0].contactCount).toBe(2);

    await db.delete(contacts).where(eq(contacts.id, petr));

    expect(await listGroups()).toEqual([{ id: tennis, name: "Теннис", contactCount: 1 }]);
  });
});

describe("listContactGroups", () => {
  // Scenario "Контакт в группах"
  it("gives the groups of the contact in alphabetical order", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    await makeGroup("Друзья");
    const ivan = await makeContact("Иван");
    await addToGroup(ivan, tennis);
    await addToGroup(ivan, family);

    expect(await listContactGroups(ivan)).toEqual([
      { id: family, name: "Семья" },
      { id: tennis, name: "Теннис" },
    ]);
  });

  // Scenario "Контакт без групп"
  it("gives an empty list for a contact without groups", async () => {
    await makeGroup("Теннис");
    const ivan = await makeContact("Иван");

    expect(await listContactGroups(ivan)).toEqual([]);
  });

  it("does not give the groups of other contacts", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");
    const petr = await makeContact("Пётр");
    await addToGroup(petr, tennis);

    expect(await listContactGroups(ivan)).toEqual([]);
  });
});

/** The names of the contact's groups, in alphabetical order. */
async function groupNamesOf(contactId: number) {
  const rows = await db
    .select({ name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(eq(contactGroups.contactId, contactId))
    .orderBy(sql`${groups.name} collate "ru-x-icu"`);
  return rows.map((row) => row.name);
}

describe("findOrCreateGroup", () => {
  it("gives the id of the group that has the name, whatever the case", async () => {
    const tennis = await makeGroup("Теннис");

    expect(await db.transaction((tx) => findOrCreateGroup(tx, "теннис"))).toBe(tennis);
    expect(await listGroups()).toHaveLength(1);
  });

  it("creates the group when there is none", async () => {
    const id = await db.transaction((tx) => findOrCreateGroup(tx, "Аналитики"));

    expect(await getGroup(id)).toEqual({ id, name: "Аналитики" });
  });

  it("makes one group out of two calls at once", async () => {
    const [first, second] = await Promise.all([
      db.transaction((tx) => findOrCreateGroup(tx, "Теннис")),
      db.transaction((tx) => findOrCreateGroup(tx, "теннис")),
    ]);

    expect(first).toBe(second);
    expect(await listGroups()).toHaveLength(1);
  });
});

describe("setContactGroups", () => {
  const save = (contactId: number, input: { groupIds: number[]; newGroupNames: string[] }) =>
    db.transaction((tx) => setContactGroups(tx, contactId, input));

  // Scenario "Отметили группы при добавлении"
  it("puts the contact into the checked groups", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    await makeGroup("Друзья");
    const ivan = await makeContact("Иван");

    await save(ivan, { groupIds: [tennis, family], newGroupNames: [] });

    expect(await groupNamesOf(ivan)).toEqual(["Семья", "Теннис"]);
  });

  // Scenario "Сняли галочку"
  it("takes the contact out of a group that is no longer checked, and keeps the group", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    const ivan = await makeContact("Иван");
    await save(ivan, { groupIds: [tennis, family], newGroupNames: [] });

    await save(ivan, { groupIds: [family], newGroupNames: [] });

    expect(await groupNamesOf(ivan)).toEqual(["Семья"]);
    expect((await listGroups()).map((group) => group.name)).toEqual(["Семья", "Теннис"]);
  });

  it("takes the contact out of every group when none is checked", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");
    await save(ivan, { groupIds: [tennis], newGroupNames: [] });

    await save(ivan, { groupIds: [], newGroupNames: [] });

    expect(await groupNamesOf(ivan)).toEqual([]);
  });

  it("does not touch the groups of other contacts", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");
    const petr = await makeContact("Пётр");
    await addToGroup(petr, tennis);

    await save(ivan, { groupIds: [tennis], newGroupNames: [] });
    await save(ivan, { groupIds: [], newGroupNames: [] });

    expect(await groupNamesOf(petr)).toEqual(["Теннис"]);
  });

  // Scenario "Создали группу в окне"
  it("creates the new group and puts the contact into it", async () => {
    const ivan = await makeContact("Иван");

    await save(ivan, { groupIds: [], newGroupNames: ["Аналитики"] });

    expect(await groupNamesOf(ivan)).toEqual(["Аналитики"]);
    expect(await listGroups()).toEqual([
      { id: expect.any(Number), name: "Аналитики", contactCount: 1 },
    ]);
  });

  // Scenario "Название уже есть"
  it("takes the existing group for a new name that is already there", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");

    await save(ivan, { groupIds: [], newGroupNames: ["теннис"] });

    expect(await groupNamesOf(ivan)).toEqual(["Теннис"]);
    expect(await listGroups()).toEqual([{ id: tennis, name: "Теннис", contactCount: 1 }]);
  });

  it("puts the contact into a group once, however many ways name it", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");

    await save(ivan, { groupIds: [tennis, tennis], newGroupNames: ["Теннис", "теннис"] });

    expect(await db.$count(contactGroups)).toBe(1);
  });

  // Scenario "Группу удалили, пока окно открыто"
  it("skips a group deleted meanwhile, without an error", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    const ivan = await makeContact("Иван");
    await deleteGroup(tennis);

    await save(ivan, { groupIds: [tennis, family], newGroupNames: [] });

    expect(await groupNamesOf(ivan)).toEqual(["Семья"]);
  });

  it("changes nothing when the transaction is rolled back", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");

    await expect(
      db.transaction(async (tx) => {
        await setContactGroups(tx, ivan, { groupIds: [tennis], newGroupNames: ["Аналитики"] });
        throw new Error("the contact could not be saved");
      }),
    ).rejects.toThrow("could not be saved");

    expect(await groupNamesOf(ivan)).toEqual([]);
    expect((await listGroups()).map((group) => group.name)).toEqual(["Теннис"]);
  });
});

describe("setContactGroupMembership", () => {
  // Scenario "Добавили в группу"
  it("puts the contact into the group", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");

    await setContactGroupMembership(ivan, tennis, true);

    expect(await groupNamesOf(ivan)).toEqual(["Теннис"]);
  });

  // Scenario "Убрали из группы"
  it("takes the contact out of the group and the group loses one contact", async () => {
    const family = await makeGroup("Семья");
    const ivan = await makeContact("Иван");
    const petr = await makeContact("Пётр");
    await addToGroup(ivan, family);
    await addToGroup(petr, family);

    await setContactGroupMembership(ivan, family, false);

    expect(await groupNamesOf(ivan)).toEqual([]);
    expect(await listGroups()).toEqual([{ id: family, name: "Семья", contactCount: 1 }]);
  });

  // Scenario "Быстро отметили и сняли"
  it("ends as the last call says when a group is checked and unchecked at once", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");

    await setContactGroupMembership(ivan, tennis, true);
    await setContactGroupMembership(ivan, tennis, false);

    expect(await groupNamesOf(ivan)).toEqual([]);
  });

  it("does not make a second link when the contact is put into the group twice", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");

    await setContactGroupMembership(ivan, tennis, true);
    await setContactGroupMembership(ivan, tennis, true);

    expect(await db.$count(contactGroups)).toBe(1);
  });

  it("does nothing when a contact that is not in the group is taken out", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");

    await expect(setContactGroupMembership(ivan, tennis, false)).resolves.toBeUndefined();

    expect(await db.$count(contactGroups)).toBe(0);
  });

  it("leaves the other groups of the contact as they are", async () => {
    const tennis = await makeGroup("Теннис");
    const family = await makeGroup("Семья");
    const ivan = await makeContact("Иван");
    await addToGroup(ivan, family);

    await setContactGroupMembership(ivan, tennis, true);
    await setContactGroupMembership(ivan, tennis, false);

    expect(await groupNamesOf(ivan)).toEqual(["Семья"]);
  });
});

describe("addContactToNewGroup", () => {
  // Scenario "Новая группа в карточке"
  it("creates the group and puts the contact into it", async () => {
    const ivan = await makeContact("Иван");

    const result = await addContactToNewGroup(ivan, "Аналитики");

    expect(result).toEqual({ ok: true, group: { id: expect.any(Number), name: "Аналитики" } });
    expect(await listGroups()).toEqual([
      { id: expect.any(Number), name: "Аналитики", contactCount: 1 },
    ]);
    expect(await groupNamesOf(ivan)).toEqual(["Аналитики"]);
  });

  // Scenario "Название уже есть в карточке"
  it("puts the contact into the group that already has the name, and makes no new one", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");

    const result = await addContactToNewGroup(ivan, "теннис");

    expect(result).toEqual({ ok: true, group: { id: tennis, name: "Теннис" } });
    expect(await listGroups()).toEqual([{ id: tennis, name: "Теннис", contactCount: 1 }]);
  });

  it("is fine when the contact is already in the group", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact("Иван");
    await addToGroup(ivan, tennis);

    expect(await addContactToNewGroup(ivan, "Теннис")).toMatchObject({ ok: true });
    expect(await db.$count(contactGroups)).toBe(1);
  });

  // Scenario "Неверное название в карточке"
  it("refuses an empty name and a name over 50 characters, and saves nothing", async () => {
    const ivan = await makeContact("Иван");

    expect(await addContactToNewGroup(ivan, "  ")).toEqual({
      ok: false,
      error: "Укажите название группы",
    });
    expect(await addContactToNewGroup(ivan, "а".repeat(51))).toEqual({
      ok: false,
      error: "Не длиннее 50 символов",
    });

    expect(await listGroups()).toEqual([]);
  });

  it("creates no group when the contact is gone, for example deleted in another tab", async () => {
    const ivan = await makeContact("Иван");
    await db.delete(contacts).where(eq(contacts.id, ivan));

    await expect(addContactToNewGroup(ivan, "Аналитики")).rejects.toThrow();

    expect(await listGroups()).toEqual([]);
  });
});
