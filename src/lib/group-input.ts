import { z } from "zod";

/** The name of a group, as the user may type it: no spaces around it, 1 to 50 characters. */
export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название группы")
  .max(50, "Не длиннее 50 символов");

/**
 * The name without the difference in case: two names with the same key are the same group.
 * The browser uses it to find a group that already exists without asking the server;
 * the database decides in the end, with the same rule (`groups_name_key`).
 */
export function groupNameKey(name: string) {
  return name.toLocaleLowerCase("ru");
}

export const groupIdSchema = z.number().int().positive();

/** What saving a group says: its id, or the error to show next to the name field. */
export type SaveGroupResult = { ok: true; id: number } | { ok: false; error: string };

/** The groups a contact is saved with: the checked ones, and the names of groups to create. */
export const contactGroupsInputSchema = z.object({
  groupIds: z.array(groupIdSchema),
  newGroupNames: z.array(groupNameSchema),
});

export type ContactGroupsInput = z.infer<typeof contactGroupsInputSchema>;
