"use server";

import { eq } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";

import { db } from "@/db";
import { listContactsPage } from "@/db/queries";
import { contacts, notes } from "@/db/schema";
import {
  contactIdSchema,
  contactInputSchema,
  fieldErrors,
  noteInputSchema,
  type ContactFormErrors,
} from "@/lib/contact-input";
import { contactCursorSchema, contactsLimitSchema, type ContactsPage } from "@/lib/contact-list";

type SaveContactResult = { ok: true; id: number } | { ok: false; errors: ContactFormErrors };

type AddNoteResult = { ok: true } | { ok: false; error: string };

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
