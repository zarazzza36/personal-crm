import "server-only";

import { eq, sql } from "drizzle-orm";

import type { ContactInput } from "@/lib/contact-input";

import { db } from "./index";
import { contacts } from "./schema";

/** `db` or a transaction: saving a contact goes together with saving its groups. */
type Executor = Pick<typeof db, "insert" | "update">;

/**
 * Saves a new contact and gives its id. A frequency chosen in the form starts its countdown now:
 * until the first note the term counts from this moment.
 */
export async function insertContact(executor: Executor, input: ContactInput): Promise<number> {
  const [row] = await executor
    .insert(contacts)
    .values({
      ...input,
      contactFrequencySetAt: input.contactFrequency ? sql`now()` : null,
    })
    .returning({ id: contacts.id });
  return row.id;
}

/**
 * Saves the contact's fields; gives its id, or undefined when there is no such contact.
 * A changed frequency starts its countdown now, the same one keeps it, no frequency clears it.
 */
export async function updateContact(
  executor: Executor,
  id: number,
  input: ContactInput,
): Promise<number | undefined> {
  // Decided by the row being updated, so a save with the same frequency keeps the countdown.
  const frequency = sql`${input.contactFrequency}::contact_frequency`;
  const [row] = await executor
    .update(contacts)
    .set({
      ...input,
      contactFrequencySetAt: sql`case
        when ${frequency} is null then null
        when ${frequency} = ${contacts.contactFrequency} then ${contacts.contactFrequencySetAt}
        else now()
      end`,
    })
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });
  return row?.id;
}
