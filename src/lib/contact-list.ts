import { z } from "zod";

import type { BodyType } from "./body-types";
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
  capacityTons: number | null;
  volumeCubicMeters: number | null;
  bodyType: BodyType | null;
  /** The names of the contact's groups in alphabetical order; empty without groups. */
  groupNames: string[];
};

/** A place in the alphabetical list: the contact that the loaded part ends with. */
export const contactCursorSchema = z.object({ name: z.string(), id: contactIdSchema });

export type ContactCursor = z.infer<typeof contactCursorSchema>;

export const contactsLimitSchema = z.number().int().positive();

/** A part of the list; `nextCursor` is `null` when the list ends with it. */
export type ContactsPage = { items: ContactListItem[]; nextCursor: ContactCursor | null };

/** Group id taken from a URL (`/?group=12`); `null` unless it is a plain positive integer. */
export function parseGroupId(value: string | undefined) {
  return value !== undefined && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : null;
}

/**
 * The address of the list for a search query and a chosen group: `/`, `/?q=иван`, `/?group=12`
 * or `/?q=иван&group=12`. The search box and the group buttons both build it here, so changing
 * one never loses the other.
 */
export function contactsUrl({ query, groupId }: { query: string; groupId: number | null }) {
  const params = [
    query ? `q=${encodeURIComponent(query)}` : null,
    groupId !== null ? `group=${groupId}` : null,
  ].filter((param) => param !== null);
  return params.length > 0 ? `/?${params.join("&")}` : "/";
}
