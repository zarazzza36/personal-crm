"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { groupNameKey, groupNameSchema } from "@/lib/group-input";
import type { Group } from "@/lib/groups";

const russianOrder = new Intl.Collator("ru");

/** A line of the list: a group that exists, or a name that is created together with the contact. */
type Item = { id: number; name: string } | { id: null; name: string };

/**
 * The field "Группы" of the contact window: all groups with checkboxes, and "Новая группа"
 * with "Добавить". The checked groups go with the form as `groupIds`, the new names as
 * `newGroupNames`; a new name becomes a group only when the contact is saved. The state is
 * kept here, so a form that is sent back with an error in another field keeps it.
 */
export function ContactGroupsField({
  groups,
  checkedGroupIds,
  error,
}: {
  /** Every group that exists, in alphabetical order. */
  groups: Group[];
  /** The groups the contact is in now. */
  checkedGroupIds: number[];
  /** The error of the save: a wrong name of a new group. */
  error?: string;
}) {
  const labelId = useId();
  const nameId = useId();
  const nameErrorId = useId();
  const [checkedIds, setCheckedIds] = useState(() => new Set(checkedGroupIds));
  const [newNames, setNewNames] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string>();

  const items: Item[] = [
    ...groups,
    ...newNames.map((newName): Item => ({ id: null, name: newName })),
  ].sort((a, b) => russianOrder.compare(a.name, b.name));

  function setChecked(id: number, checked: boolean) {
    const next = new Set(checkedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setCheckedIds(next);
  }

  function addNewName() {
    const parsed = groupNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0].message);
      return;
    }

    // A name that is already there checks that group instead of making a second one.
    const key = groupNameKey(parsed.data);
    const existing = groups.find((group) => groupNameKey(group.name) === key);
    if (existing) {
      setChecked(existing.id, true);
    } else if (!newNames.some((newName) => groupNameKey(newName) === key)) {
      setNewNames([...newNames, parsed.data]);
    }
    setName("");
    setNameError(undefined);
  }

  const shownError = nameError ?? error;

  return (
    <div role="group" aria-labelledby={labelId} className="grid gap-1.5">
      <span id={labelId} className="text-xs leading-none tracking-label text-dim uppercase">
        Группы
      </span>
      {items.length > 0 && (
        <ul className="grid">
          {items.map((item) => (
            <li key={item.id ?? `new:${item.name}`}>
              <label className="flex cursor-pointer items-center gap-2.5 py-1.5">
                {item.id === null ? (
                  // Not in the database yet: unchecking takes the name off the list.
                  <>
                    <Checkbox
                      checked
                      onCheckedChange={() =>
                        setNewNames(newNames.filter((newName) => newName !== item.name))
                      }
                    />
                    <input type="hidden" name="newGroupNames" value={item.name} />
                  </>
                ) : (
                  <Checkbox
                    name="groupIds"
                    value={String(item.id)}
                    checked={checkedIds.has(item.id)}
                    onCheckedChange={(checked) => setChecked(item.id, checked)}
                  />
                )}
                <span className="min-w-0 text-sm wrap-anywhere">{item.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={nameId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          // Enter adds the group: it must not send the whole form.
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addNewName();
            }
          }}
          placeholder="Новая группа"
          aria-label="Новая группа"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? nameErrorId : undefined}
        />
        <Button type="button" variant="outline" onClick={addNewName}>
          Добавить
        </Button>
      </div>
      {shownError && (
        <p id={nameErrorId} className="text-sm text-destructive">
          {shownError}
        </p>
      )}
    </div>
  );
}
