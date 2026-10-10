"use client";

import { useActionState, useId } from "react";

import { addNote } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type FormState = { body: string; error?: string };

export function NoteForm({ contactId }: { contactId: number }) {
  const errorId = useId();
  const [{ body, error }, formAction, isPending] = useActionState(
    async (_previous: FormState, formData: FormData): Promise<FormState> => {
      const submitted = String(formData.get("body") ?? "");
      const result = await addNote(contactId, submitted);
      // On failure keep the text so nothing typed is lost.
      return result.ok ? { body: "" } : { body: submitted, error: result.error };
    },
    { body: "" },
  );

  return (
    <form action={formAction} className="grid gap-2">
      <Textarea
        name="body"
        defaultValue={body}
        placeholder="О чём говорили, о чём договорились"
        aria-label="Новая заметка"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-24"
        required
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Сохраняю…" : "Сохранить заметку"}
        </Button>
      </div>
    </form>
  );
}
