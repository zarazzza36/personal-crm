import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";

import { groupNameSchema, type ContactGroupsInput, type SaveGroupResult } from "@/lib/group-input";
import type { AddToGroupResult, Group, GroupListItem } from "@/lib/groups";

import { db } from "./index";
import { contactGroups, groups } from "./schema";

export const GROUP_EXISTS_ERROR = "Такая группа уже есть";

// Russian alphabetical order, case ignored; the id keeps the order fixed for equal names.
const alphabeticalOrder = [sql`${groups.name} collate "ru-x-icu"`, asc(groups.id)];

/** Every group with the number of its contacts, in alphabetical order. */
export async function listGroups(): Promise<GroupListItem[]> {
  return db
    .select({ id: groups.id, name: groups.name, contactCount: count(contactGroups.contactId) })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(...alphabeticalOrder);
}

/** The groups the contact is in, in alphabetical order; empty when it is in none. */
export async function listContactGroups(contactId: number): Promise<Group[]> {
  return db
    .select({ id: groups.id, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(eq(contactGroups.contactId, contactId))
    .orderBy(...alphabeticalOrder);
}

/** The group, or `undefined` when there is no group with this id. */
export async function getGroup(id: number): Promise<Group | undefined> {
  const [group] = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(eq(groups.id, id));
  return group;
}

/**
 * Creates a group. The name is checked here, so no caller can save an empty one. Two groups
 * never have the same name, whatever the case: the database decides, so two tabs creating
 * "Теннис" at once get one group and one error.
 */
export async function createGroup(name: string): Promise<SaveGroupResult> {
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const [created] = await db
    .insert(groups)
    .values({ name: parsed.data })
    .onConflictDoNothing()
    .returning({ id: groups.id });
  return created ? { ok: true, id: created.id } : { ok: false, error: GROUP_EXISTS_ERROR };
}

/** The database refused a row because another one has the same unique value. */
function isUniqueViolation(error: unknown): boolean {
  // Drizzle wraps the driver's error and keeps it in `cause`.
  for (let current = error; current instanceof Error; current = current.cause) {
    if ("code" in current && current.code === "23505") return true;
  }
  return false;
}

/**
 * Renames a group; its contacts stay. A new name that differs from the old one only by case
 * is fine: the unique index compares a group with the other groups, not with itself.
 * Throws when there is no such group.
 */
export async function renameGroup(id: number, name: string): Promise<SaveGroupResult> {
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    const [renamed] = await db
      .update(groups)
      .set({ name: parsed.data })
      .where(eq(groups.id, id))
      .returning({ id: groups.id });
    if (!renamed) {
      throw new Error(`Group ${id} not found`);
    }
    return { ok: true, id: renamed.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: GROUP_EXISTS_ERROR };
    }
    throw error;
  }
}

/** Deletes the group and its links to contacts (the database cascades); the contacts stay. */
export async function deleteGroup(id: number) {
  await db.delete(groups).where(eq(groups.id, id));
}

/** The database or a transaction of it: the group functions that join a bigger save take either. */
type Executor = Pick<typeof db, "select" | "insert" | "delete" | "execute">;

/**
 * The id of the group with this name, created when there is none. The name is already checked
 * (`groupNameSchema`). Two saves at once with the same new name get the same group.
 */
export async function findOrCreateGroup(executor: Executor, name: string): Promise<number> {
  await executor.insert(groups).values({ name }).onConflictDoNothing();

  const [group] = await executor
    .select({ id: groups.id })
    .from(groups)
    .where(sql`lower(${groups.name} collate "ru-x-icu") = lower(${name}::text collate "ru-x-icu")`);
  if (!group) {
    // Deleted by someone between the two queries.
    throw new Error(`Group "${name}" disappeared while it was being saved`);
  }
  return group.id;
}

/**
 * Makes the contact's groups exactly the checked ones plus the new ones: the old links are
 * replaced. Ids of groups that are gone (deleted in another tab while the window was open)
 * are skipped, not an error: the links are made from the groups the database has.
 * Called in the same transaction as the contact is saved in, so nothing is half-saved.
 */
export async function setContactGroups(
  executor: Executor,
  contactId: number,
  { groupIds, newGroupNames }: ContactGroupsInput,
) {
  const ids = new Set(groupIds);
  for (const name of newGroupNames) {
    ids.add(await findOrCreateGroup(executor, name));
  }

  await executor.delete(contactGroups).where(eq(contactGroups.contactId, contactId));
  if (ids.size === 0) return;

  await executor.execute(sql`
    insert into ${contactGroups} (contact_id, group_id)
    select ${contactId}::integer, ${groups.id} from ${groups}
    where ${groups.id} in (${sql.join(
      Array.from(ids, (id) => sql`${id}`),
      sql`, `,
    )})
    on conflict do nothing
  `);
}

/**
 * Puts the contact into the group or takes it out, as `member` says. It says the wanted state
 * and does not toggle: two quick clicks on one checkbox end as the last one says. Putting a
 * contact into a group it is in, or taking it out of one it is not in, does nothing.
 */
export async function setContactGroupMembership(
  contactId: number,
  groupId: number,
  member: boolean,
) {
  if (member) {
    await db.insert(contactGroups).values({ contactId, groupId }).onConflictDoNothing();
  } else {
    await db
      .delete(contactGroups)
      .where(and(eq(contactGroups.contactId, contactId), eq(contactGroups.groupId, groupId)));
  }
}

/**
 * "Новая группа" in the card: puts the contact into the group with this name, creating the group
 * when there is none, in one transaction. Gives the group the contact is in now: the existing
 * one, with its own spelling, when the name was taken.
 */
export async function addContactToNewGroup(
  contactId: number,
  name: string,
): Promise<AddToGroupResult> {
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const group = await db.transaction(async (tx) => {
    const id = await findOrCreateGroup(tx, parsed.data);
    await tx.insert(contactGroups).values({ contactId, groupId: id }).onConflictDoNothing();

    const [row] = await tx
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.id, id));
    return row;
  });
  return { ok: true, group };
}
