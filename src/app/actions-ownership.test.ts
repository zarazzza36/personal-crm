import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/auth/session", () => ({
  getCurrentUser: async () => ({ id: session.userId, email: "test@example.com" }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));

import { db } from "@/db";
import { contacts, groups, notes, users } from "@/db/schema";

import {
  addNote,
  deleteContact,
  deleteGroup,
  dismissReminder,
  removeNoteReminder,
  setContactGroupMembership,
  setNoteReminder,
  updateContact,
} from "./actions";

it("прямые действия другого пользователя не изменяют чужие данные", async () => {
  const a = randomUUID();
  const b = randomUUID();
  session.userId = b;
  await db.insert(users).values([
    { id: a, name: "", email: "action-a@example.com" },
    { id: b, name: "", email: "action-b@example.com" },
  ]);
  const [contact] = await db.insert(contacts).values({ name: "Анна", userId: a }).returning();
  const [group] = await db.insert(groups).values({ name: "Семья", userId: a }).returning();
  const remindAt = new Date("2030-01-01T12:00:00Z");
  const [note] = await db
    .insert(notes)
    .values({ contactId: contact.id, body: "Личное", remindAt })
    .returning();

  await expect(addNote(contact.id, "Чужая запись")).rejects.toThrow("not found");
  await expect(
    updateContact(
      contact.id,
      {
        name: "Подмена",
        about: "",
        howWeMet: "",
        phone: "",
        email: "",
        capacityTons: "",
        volumeCubicMeters: "",
        bodyType: "",
        contactFrequency: "",
      },
      { groupIds: [], newGroupNames: [] },
    ),
  ).rejects.toThrow("not found");
  await expect(deleteContact(contact.id)).rejects.toThrow();
  await deleteGroup(group.id);
  await setContactGroupMembership(contact.id, group.id, true);
  await removeNoteReminder(note.id);
  await dismissReminder(note.id, remindAt.getTime());
  await expect(setNoteReminder(note.id, { date: "2030-01-02", time: "15:00" })).rejects.toThrow(
    "not found",
  );
  expect(await db.$count(notes)).toBe(1);
  expect(await db.$count(contacts, eq(contacts.id, contact.id))).toBe(1);
  expect((await db.select().from(notes).where(eq(notes.id, note.id)))[0].remindAt).toEqual(
    remindAt,
  );
  expect(await db.$count(groups, eq(groups.id, group.id))).toBe(1);
});
