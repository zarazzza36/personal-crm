/** A group, as the filter and the lists with checkboxes show it. */
export type Group = { id: number; name: string };

/** A group on the page "Группы": with the number of its contacts. */
export type GroupListItem = Group & { contactCount: number };

/** What adding a contact to a group by name says: the group it is in now, or the name's error. */
export type AddToGroupResult = { ok: true; group: Group } | { ok: false; error: string };
