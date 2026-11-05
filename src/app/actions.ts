"use server";

import { and, eq } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import * as contactData from "@/db/contacts";
import * as groupData from "@/db/groups";
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
import { contactGroupsInputSchema, groupIdSchema, type SaveGroupResult } from "@/lib/group-input";
import type { AddToGroupResult } from "@/lib/groups";
import { reminderMomentSchema, type Reminder } from "@/lib/reminders";

type SaveContactResult = { ok: true; id: number } | { ok: false; errors: ContactFormErrors };

type AddNoteResult = { ok: true } | { ok: false; error: string };

type SaveReminderResult = { ok: true } | { ok: false; error: string };

/**
 * The part of the contact list that follows `cursor`: the list asks for it on scroll.
 * `groupId` is the group the list is filtered by, or `null`.
 */
export async function loadContactsPage(
  cursor: unknown,
  limit: unknown,
  groupId: unknown,
): Promise<ContactsPage> {
  return listContactsPage(
    contactCursorSchema.parse(cursor),
    contactsLimitSchema.parse(limit),
    groupIdSchema.nullable().parse(groupId),
  );
}

/**
 * Checks the text fields and the groups of the contact form together, so one answer carries
 * every error. A wrong name of a new group is the error of the "Группы" field.
 */
function parseContactForm(input: unknown, groups: unknown) {
  const contact = contactInputSchema.safeParse(input);
  const contactGroups = contactGroupsInputSchema.safeParse(groups);
  if (contact.success && contactGroups.success) {
    return { ok: true as const, contact: contact.data, groups: contactGroups.data };
  }

  const errors: ContactFormErrors = contact.success ? {} : fieldErrors(contact.error);
  if (!contactGroups.success) {
    errors.groups = contactGroups.error.issues[0].message;
  }
  return { ok: false as const, errors };
}

export async function createContact(input: unknown, groups: unknown): Promise<SaveContactResult> {
  const parsed = parseContactForm(input, groups);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  // The contact and its groups are saved together or not at all.
  const createdId = await db.transaction(async (tx) => {
    const id = await contactData.insertContact(tx, parsed.contact);
    await groupData.setContactGroups(tx, id, parsed.groups);
    return id;
  });

  if (parsed.groups.groupIds.length > 0 || parsed.groups.newGroupNames.length > 0) {
    // The groups' pages show the number of contacts and the new groups: refresh them too.
    revalidatePath("/", "layout");
  }
  return { ok: true, id: createdId };
}

export async function updateContact(
  id: unknown,
  input: unknown,
  groups: unknown,
): Promise<SaveContactResult> {
  const contactId = contactIdSchema.parse(id);
  const parsed = parseContactForm(input, groups);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  await db.transaction(async (tx) => {
    const updatedId = await contactData.updateContact(tx, contactId, parsed.contact);
    if (updatedId === undefined) {
      throw new Error(`Contact ${contactId} not found`);
    }
    await groupData.setContactGroups(tx, updatedId, parsed.groups);
  });

  // The contact is shown both in its card and in the list: refresh every page.
  revalidatePath("/", "layout");
  return { ok: true, id: contactId };
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

  // A note restarts the countdown: "Пора связаться" on the list must not show the contact
  // when the list is opened by a link or by the browser's "Back".
  revalidatePath("/");
  refresh();
  return { ok: true };
}

// The groups are shown on every page: after any change all of them are refreshed. The name is
// checked in `src/db/groups.ts`, so every caller gets the same rules.

export async function createGroup(name: unknown): Promise<SaveGroupResult> {
  const result = await groupData.createGroup(z.string().parse(name));

  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

export async function renameGroup(id: unknown, name: unknown): Promise<SaveGroupResult> {
  const result = await groupData.renameGroup(groupIdSchema.parse(id), z.string().parse(name));

  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** Deletes the group; its contacts stay and just leave the group. */
export async function deleteGroup(id: unknown): Promise<void> {
  await groupData.deleteGroup(groupIdSchema.parse(id));

  revalidatePath("/", "layout");
}

/** A checkbox of the card: the contact is in the group or not, as `member` says. */
export async function setContactGroupMembership(
  contactId: unknown,
  groupId: unknown,
  member: unknown,
): Promise<void> {
  await groupData.setContactGroupMembership(
    contactIdSchema.parse(contactId),
    groupIdSchema.parse(groupId),
    z.boolean().parse(member),
  );

  revalidatePath("/", "layout");
}

/** "Новая группа" of the card: the contact goes into the group with this name, made if needed. */
export async function addContactToNewGroup(
  contactId: unknown,
  name: unknown,
): Promise<AddToGroupResult> {
  const result = await groupData.addContactToNewGroup(
    contactIdSchema.parse(contactId),
    z.string().parse(name),
  );

  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** Every reminder, due or still ahead: the notifications ask for them on every page. */
export async function loadReminders(): Promise<Reminder[]> {
  return listReminders();
}

/** Sets the note's only reminder to `date` and `time` in Moscow time, replacing the old one. */
export async function setNoteReminder(
  noteId: unknown,
  input: unknown,
): Promise<SaveReminderResult> {
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
