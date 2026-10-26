"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";

import { addNote } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  contactFrequencyLabels,
  TALKED_NOTE_BODY,
  type DueContact,
} from "@/lib/contact-frequency";
import { formatDays, formatNumber } from "@/lib/format";

/** How many contacts the block shows until "Показать всех" is pressed. */
const SHOWN_AT_FIRST = 5;

/** "Пора связаться": contacts it is time to talk to, the longest overdue first. */
export function KeepInTouch({ contacts }: { contacts: DueContact[] }) {
  const headingId = useId();
  // Not kept anywhere: after a reload the block is collapsed again.
  const [expanded, setExpanded] = useState(false);
  // A contact marked "Пообщались" leaves at once; the server then sends the block without it.
  const [due, removeContact] = useOptimistic(contacts, (current, contactId: number) =>
    current.filter((contact) => contact.id !== contactId),
  );
  // The contact whose mark was not saved: it is back in the block with a message.
  const [failedId, setFailedId] = useState<number | null>(null);
  // While a mark is saved, no checkbox takes a click: the next row moves up under the pointer,
  // and the second click of a double click must not mark that contact too.
  const [isSaving, startSaving] = useTransition();

  function markTalked(contactId: number) {
    setFailedId(null);
    startSaving(async () => {
      removeContact(contactId);
      const saved = await addNote(contactId, TALKED_NOTE_BODY).then(
        (result) => result.ok,
        () => false,
      );
      if (!saved) setFailedId(contactId);
    });
  }

  if (due.length === 0) return null;

  const shown = expanded ? due : due.slice(0, SHOWN_AT_FIRST);

  return (
    <section aria-labelledby={headingId} className="mt-5 mb-3 rounded-16 bg-asphalt p-5">
      <h2
        id={headingId}
        className="flex items-baseline gap-2.5 font-heading text-22 font-bold tracking-heading"
      >
        Пора связаться
        <span className="text-accent">{formatNumber(due.length)}</span>
      </h2>
      <ul className="mt-2 divide-y">
        {shown.map((contact) => (
          <li key={contact.id}>
            <div className="flex items-center gap-2">
              <Link
                href={`/contacts/${contact.id}`}
                className="-ml-3 block min-w-0 flex-1 rounded-xl py-2.5 pr-2 pl-3 outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <div className="truncate font-display text-15 font-medium">{contact.name}</div>
                {/* On a narrow screen the line breaks between its parts rather than losing the days. */}
                <div className="mt-0.5 text-13 text-muted-foreground">
                  <span className="whitespace-nowrap">
                    {lowercaseFirst(contactFrequencyLabels[contact.contactFrequency])} ·
                  </span>{" "}
                  <span className="whitespace-nowrap">
                    {contact.daysSinceLastNote === null
                      ? "ещё не общались"
                      : `не общались ${formatDays(contact.daysSinceLastNote)}`}
                  </span>
                </div>
              </Link>
              {/* Outside the link: a control inside a link is not allowed. */}
              <label className="flex shrink-0 cursor-pointer items-center gap-2 py-2 text-13">
                <Checkbox
                  disabled={isSaving}
                  onCheckedChange={(checked) => checked && markTalked(contact.id)}
                />
                Пообщались
              </label>
            </div>
            {failedId === contact.id && (
              <p role="alert" className="pb-2.5 text-13 text-destructive">
                Не удалось сохранить, попробуйте ещё раз
              </p>
            )}
          </li>
        ))}
      </ul>
      {due.length > SHOWN_AT_FIRST && (
        <Button variant="outline" className="mt-3" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Свернуть" : `Показать всех (${formatNumber(due.length)})`}
        </Button>
      )}
    </section>
  );
}

// "Раз в месяц" reads "раз в месяц" in the middle of a line.
function lowercaseFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
