import { randomUUID } from "node:crypto";
import { inspect } from "node:util";

import { eq } from "drizzle-orm";
import { expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/auth/session", () => ({
  getCurrentUser: async () => ({ id: session.userId, email: "test@example.com" }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));

import { db } from "@/db";
import { contacts, groups, notes, users } from "@/db/schema";
import { toMoscowInput } from "@/lib/moscow-time";
import { makeContact } from "@/test/factories";
import { makeTestUser, TEST_USER_ID } from "@/test/test-user";

import {
  addNote,
  createContact,
  deleteContact,
  deleteGroup,
  dismissReminder,
  removeNoteReminder,
  setContactGroupMembership,
  setNoteReminder,
  updateContact,
} from "./actions";

async function updateWithBirthDate(birthDate: string) {
  await makeTestUser();
  session.userId = TEST_USER_ID;
  const id = await makeContact("Анна", { birthDate: "1980-02-29" });

  const result = await updateContact(
    id,
    {
      name: "Другое имя",
      about: "",
      howWeMet: "",
      phone: "",
      email: "",
      birthDate,
      capacityTons: "",
      volumeCubicMeters: "",
      bodyType: "",
      contactFrequency: "",
    },
    { groupIds: [], newGroupNames: [] },
  );
  const [saved] = await db.select().from(contacts).where(eq(contacts.id, id));
  return { result, saved };
}

it("возвращает ошибку поля и сохраняет прежний контакт при несуществующей дате", async () => {
  const { result, saved } = await updateWithBirthDate("2001-02-29");

  expect(result).toEqual({ ok: false, errors: { birthDate: "Укажите корректную дату рождения" } });
  expect(saved).toMatchObject({ name: "Анна", birthDate: "1980-02-29" });
});

it("возвращает ошибку поля и сохраняет прежний контакт при будущей дате", async () => {
  const tomorrow = toMoscowInput(new Date(Date.now() + 24 * 60 * 60 * 1000)).date;
  const { result, saved } = await updateWithBirthDate(tomorrow);

  expect(result).toEqual({ ok: false, errors: { birthDate: "Дата рождения ещё не наступила" } });
  expect(saved).toMatchObject({ name: "Анна", birthDate: "1980-02-29" });
});

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
        birthDate: "",
        capacityTons: "",
        volumeCubicMeters: "",
        bodyType: "",
        contactFrequency: "",
      },
      { groupIds: [], newGroupNames: [] },
    ),
  ).rejects.toThrow("Failed to save contact");
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

it("does not expose submitted contact or note data when saving fails", async () => {
  const personalData = "Private Name +79991234567 private@example.com Private note";
  const original = new Error(`Failed query: ${personalData}`, {
    cause: new Error(`Database detail: ${personalData}`),
  });
  const transaction = vi.spyOn(db, "transaction").mockRejectedValue(original);
  const execute = vi.spyOn(db, "execute").mockRejectedValue(original);

  try {
    const results = await Promise.allSettled([
      createContact(
        {
          name: "Private Name",
          about: "",
          howWeMet: "",
          phone: "+79991234567",
          email: "private@example.com",
          birthDate: "",
          capacityTons: "",
          volumeCubicMeters: "",
          bodyType: "",
          contactFrequency: "",
        },
        { groupIds: [], newGroupNames: [] },
      ),
      addNote(1, "Private note"),
    ]);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(inspect(result.reason, { depth: null })).not.toContain("Private");
        expect(inspect(result.reason, { depth: null })).not.toContain("private@example.com");
        expect(inspect(result.reason, { depth: null })).not.toContain("79991234567");
        expect(result.reason.cause).toBeUndefined();
      }
    }
    expect(transaction).toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
  } finally {
    transaction.mockRestore();
    execute.mockRestore();
  }
});
