"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";

import { addContactToNewGroup, setContactGroupMembership } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { groupNameKey, groupNameSchema } from "@/lib/group-input";
import type { Group } from "@/lib/groups";

type Change = { groupId: number; member: boolean };

/**
 * The value of the row "Группы" in the card: the labels of the contact's groups and "+".
 * "+" opens the list of all groups with checkboxes and "Новая группа". Every checkbox is
 * saved at once, and the labels change at once, before the server answers; if the save fails,
 * they go back and a message says so.
 */
export function ContactGroupsEditor({
  contactId,
  groups,
  memberGroupIds,
}: {
  contactId: number;
  /** Every group that exists, in alphabetical order. */
  groups: Group[];
  /** The groups the contact is in. */
  memberGroupIds: number[];
}) {
  const nameErrorId = useId();
  // What the labels and the checkboxes show: the server's answer with the changes still being
  // saved on top of it. When the saving ends, the server's own answer takes over.
  const [shownIds, applyChange] = useOptimistic(memberGroupIds, (current, change: Change) => {
    const others = current.filter((id) => id !== change.groupId);
    return change.member ? [...others, change.groupId] : others;
  });
  const [, startSaving] = useTransition();
  const [isAdding, startAdding] = useTransition();
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string>();

  const memberGroups = groups.filter((group) => shownIds.includes(group.id));

  function setMember(groupId: number, member: boolean) {
    setFailed(false);
    // Server Actions of one tab run one after another, so two quick clicks on one checkbox
    // end as the last click says.
    startSaving(async () => {
      applyChange({ groupId, member });
      const saved = await setContactGroupMembership(contactId, groupId, member).then(
        () => true,
        () => false,
      );
      if (!saved) setFailed(true);
    });
  }

  function addNewGroup() {
    const parsed = groupNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0].message);
      return;
    }
    setNameError(undefined);
    setFailed(false);

    // A name that is already there puts the contact into that group, no new one is made.
    const key = groupNameKey(parsed.data);
    const existing = groups.find((group) => groupNameKey(group.name) === key);
    if (existing) {
      setMember(existing.id, true);
      setName("");
      return;
    }

    startAdding(async () => {
      const result = await addContactToNewGroup(contactId, parsed.data).catch(() => null);
      if (!result) {
        setFailed(true);
      } else if (result.ok) {
        setName("");
      } else {
        setNameError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {memberGroups.length > 0 ? (
        <ul className="contents" aria-label="Группы контакта">
          {memberGroups.map((group) => (
            <li
              key={group.id}
              className="rounded-full bg-ink/10 px-3 py-1 text-13 leading-snug wrap-anywhere"
            >
              {group.name}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-card-label">не указано</span>
      )}
      <Popover>
        {/* The outline of the dark pages would vanish on the light card: ink lines instead. */}
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Изменить группы"
              className="border-ink/25 text-ink hover:bg-ink/5 hover:text-ink aria-expanded:bg-ink/5 aria-expanded:text-ink"
            />
          }
        >
          <PlusIcon />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
          {groups.length > 0 && (
            <ul className="grid max-h-60 overflow-y-auto" aria-label="Все группы">
              {groups.map((group) => (
                <li key={group.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-1 py-1.5">
                    <Checkbox
                      checked={shownIds.includes(group.id)}
                      onCheckedChange={(checked) => setMember(group.id, checked)}
                    />
                    <span className="min-w-0 wrap-anywhere">{group.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              // Enter adds the group, as "Добавить" does.
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addNewGroup();
                }
              }}
              placeholder="Новая группа"
              aria-label="Новая группа"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? nameErrorId : undefined}
            />
            <Button type="button" variant="outline" disabled={isAdding} onClick={addNewGroup}>
              {isAdding ? "Добавляю…" : "Добавить"}
            </Button>
          </div>
          {nameError && (
            <p id={nameErrorId} className="text-sm text-destructive">
              {nameError}
            </p>
          )}
        </PopoverContent>
      </Popover>
      {failed && (
        <p role="alert" className="basis-full text-13 text-destructive">
          Не удалось сохранить, попробуйте ещё раз
        </p>
      )}
    </div>
  );
}
