import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";

import { db } from "@/db";
import * as groupsData from "@/db/groups";
import * as contactsData from "@/db/contacts";
import * as queries from "@/db/queries";
import { contactGroups, contacts, groups, notes, users } from "@/db/schema";

it("разделяет контакты, заметки, группы и напоминания двух пользователей", async () => {
  const a = randomUUID();
  const b = randomUUID();
  await db.insert(users).values([
    { id: a, name: "", email: "a@example.com" },
    { id: b, name: "", email: "b@example.com" },
  ]);
  const [contact] = await db
    .insert(contacts)
    .values({ userId: a, name: "Чужой контакт" })
    .returning();
  const [group] = await db.insert(groups).values({ userId: a, name: "Друзья" }).returning();
  await db
    .insert(notes)
    .values({ contactId: contact.id, body: "Чужая заметка", remindAt: new Date() });
  expect(await queries.countContacts(b)).toBe(0);
  expect(await queries.searchContacts(b, "Чужой")).toEqual([]);
  expect((await queries.listContactsPage(b, null, 10)).items).toEqual([]);
  expect(await queries.getContactListItem(b, contact.id)).toBeUndefined();
  expect(await queries.getContact(b, contact.id)).toBeUndefined();
  expect(await queries.listNotes(b, contact.id)).toEqual([]);
  expect(await queries.listReminders(b)).toEqual([]);
  expect(await groupsData.listGroups(b)).toEqual([]);
  expect(await groupsData.getGroup(b, group.id)).toBeUndefined();
  expect(await groupsData.listContactGroups(b, contact.id)).toEqual([]);
  expect(await queries.listDueContacts(b)).toEqual([]);
  await db.transaction(async (tx) => {
    await groupsData.setContactGroups(b, tx, contact.id, {
      groupIds: [],
      newGroupNames: ["Чужая новая группа"],
    });
    const result = await contactsData.updateContact(b, tx, contact.id, {
      name: "Подмена",
      about: null,
      howWeMet: null,
      phone: null,
      email: null,
      birthDate: null,
      capacityTons: null,
      volumeCubicMeters: null,
      bodyType: null,
      contactFrequency: null,
    });
    expect(result).toBeUndefined();
  });
  expect(await groupsData.listGroups(b)).toEqual([]);
  await groupsData.setContactGroupMembership(b, contact.id, group.id, true);
  await expect(
    groupsData.addContactToNewGroup(b, contact.id, "Чужая новая группа"),
  ).rejects.toThrow("not found");
  await expect(groupsData.renameGroup(b, group.id, "Подмена")).rejects.toThrow("not found");
  expect(await groupsData.listContactGroups(a, contact.id)).toEqual([]);
  await groupsData.deleteGroup(b, group.id);
  expect(await groupsData.getGroup(a, group.id)).toBeDefined();
  const otherGroup = await groupsData.createGroup(b, "Друзья");
  expect(otherGroup).toMatchObject({ ok: true });
  if (!otherGroup.ok) throw new Error("group creation failed");
  await groupsData.setContactGroupMembership(a, contact.id, otherGroup.id, true);
  expect(await db.$count(contactGroups)).toBe(0);
  expect(await groupsData.findOrCreateGroup(b, db, "Друзья")).toBe(otherGroup.id);
  expect(await groupsData.createGroup(a, "друзья")).toMatchObject({ ok: false });
  expect(await queries.getContact(a, contact.id)).toBeDefined();
});
