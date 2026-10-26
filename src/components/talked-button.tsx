"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";

import { addNote } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { TALKED_NOTE_BODY } from "@/lib/contact-frequency";

/** "Пообщались" in the card: saves the note "Пообщались", so the countdown starts again. */
export function TalkedButton({ contactId }: { contactId: number }) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function markTalked() {
    setFailed(false);
    startTransition(async () => {
      const saved = await addNote(contactId, TALKED_NOTE_BODY).then(
        (result) => result.ok,
        () => false,
      );
      if (!saved) setFailed(true);
    });
  }

  return (
    <>
      {/* The outline of the dark pages would vanish on the light card: ink lines instead. */}
      <Button
        variant="outline"
        size="sm"
        className="border-ink/25 text-ink hover:bg-ink/5 hover:text-ink"
        disabled={isPending}
        onClick={markTalked}
      >
        <CheckIcon data-icon="inline-start" />
        {isPending ? "Сохраняю…" : "Пообщались"}
      </Button>
      {failed && (
        <p role="alert" className="basis-full text-13 text-destructive">
          Не удалось сохранить, попробуйте ещё раз
        </p>
      )}
    </>
  );
}
