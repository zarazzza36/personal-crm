"use server";

import { and, eq } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";

import { db } from "@/db";
import { listContactsPage, listReminders } from "@/db/queries";
import { contacts, notes } from "@/db/schema";
import {
  contactIdSchema,
  contactInputSchema,
  fieldErrors,
  noteIdSchema,
  noteInputSchema,
  reminderInputSchema,
  type ContactFormErrors,
} from "@/lib/contact-input";
import { contactCursorSchema, contactsLimitSchema, type ContactsPage } from "@/lib/contact-list";
import { reminderMomentSchema, type Reminder } from "@/lib/reminders";

type SaveContactResult = { ok: true; id: number } | { ok: false; errors: ContactFormErrors };

type AddNoteResult = { ok: true } | { ok: false; error: string };

type SaveReminderResult = { ok: true } | { ok: false; error: string };

/** The part of the contact list that follows `cursor`: the list asks for it on scroll. */
export async function loadContactsPage(cursor: unknown, limit: unknown): Promise<ContactsPage> {
  return listContactsPage(contactCursorSchema.parse(cursor), contactsLimitSchema.parse(limit));
}

export async function createContact(input: unknown): Promise<SaveContactResult> {
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const [created] = await db.insert(contacts).values(parsed.data).returning({ id: contacts.id });
  return { ok: true, id: created.id };
}

export async function updateContact(id: unknown, input: unknown): Promise<SaveContactResult> {
  const contactId = contactIdSchema.parse(id);
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const [updated] = await db
    .update(contacts)
    .set(parsed.data)
    .where(eq(contacts.id, contactId))
    .returning({ id: contacts.id });
  if (!updated) {
    throw new Error(`Contact ${contactId} not found`);
  }

  // The contact is shown both in its card and in the list: refresh every page.
  revalidatePath("/", "layout");
  return { ok: true, id: updated.id };
}

/** Deletes the contact with all its notes (the database cascades), then opens the list. */
export async function deleteContact(id: unknown): Promise<never> {
  const contactId = contactIdSchema.parse(id);

  await db.delete(contacts).where(eq(contacts.id, contactId));

  revalidatePath("/", "layout");
  // Replace the card in the browser history: "Back" must not lead to a deleted contact.
  redirect("/", RedirectType.replace);
}

export async function addNote(contactId: unknown, body: unknown): Promise<AddNoteResult> {
  const id = contactIdSchema.parse(contactId);
  const parsed = noteInputSchema.safeParse({ body });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await db.insert(notes).values({ contactId: id, body: parsed.data.body });

  refresh();
  return { ok: true };
}

/** Every reminder, due or still ahead: the notifications ask for them on every page. */
export async function loadReminders(): Promise<Reminder[]> {
  return listReminders();
}

/** Sets the note's only reminder to `date` and `time` in Moscow time, replacing the old one. */
export async function setNoteReminder(noteId: unknown, input: unknown): Promise<SaveReminderResult> {
  const id = noteIdSchema.parse(noteId);
  const parsed = reminderInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const [updated] = await db
    .update(notes)
    .set({ remindAt: parsed.data })
    .where(eq(notes.id, id))
    .returning({ id: notes.id });
  if (!updated) {
    throw new Error(`Note ${id} not found`);
  }

  refresh();
  return { ok: true };
}

export async function removeNoteReminder(noteId: unknown): Promise<void> {
  const id = noteIdSchema.parse(noteId);

  await db.update(notes).set({ remindAt: null }).where(eq(notes.id, id));

  refresh();
}

/**
 * A closed notification: its reminder is done. Only the reminder that was shown is cleared,
 * so one moved to another time in another tab meanwhile stays.
 */
export async function dismissReminder(noteId: unknown, remindAt: unknown): Promise<void> {
  const id = noteIdSchema.parse(noteId);
  const shownRemindAt = reminderMomentSchema.parse(remindAt);

  await db
    .update(notes)
    .set({ remindAt: null })
    .where(and(eq(notes.id, id), eq(notes.remindAt, shownRemindAt)));

  refresh();
}
