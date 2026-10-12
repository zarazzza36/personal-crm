import { z } from "zod";

import { contactIdSchema } from "./contact-input";

/** How many contacts the list shows at first and adds each time it is scrolled to its end. */
export const CONTACTS_PAGE_SIZE = 50;

/** A contact as a row of the list. */
export type ContactListItem = {
  id: number;
  name: string;
  about: string | null;
  phone: string | null;
  email: string | null;
};

/** A place in the alphabetical list: the contact that the loaded part ends with. */
export const contactCursorSchema = z.object({ name: z.string(), id: contactIdSchema });

export type ContactCursor = z.infer<typeof contactCursorSchema>;

export const contactsLimitSchema = z.number().int().positive();

/** A part of the list; `nextCursor` is `null` when the list ends with it. */
export type ContactsPage = { items: ContactListItem[]; nextCursor: ContactCursor | null };
