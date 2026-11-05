"use client";

import { useActionState, useId } from "react";

import { createGroup } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormState = { name: string; error?: string };

/** The field "Новая группа" with "Создать" on the page "Группы". */
export function NewGroupForm() {
  const errorId = useId();
  const [{ name, error }, formAction, isPending] = useActionState(
    async (_previous: FormState, formData: FormData): Promise<FormState> => {
      const submitted = String(formData.get("name") ?? "");
      const result = await createGroup(submitted);
      // On failure keep the text so nothing typed is lost.
      return result.ok ? { name: "" } : { name: submitted, error: result.error };
    },
    { name: "" },
  );

  return (
    <form action={formAction} autoComplete="off" className="grid gap-2">
      <div className="flex gap-2">
        <Input
          name="name"
          defaultValue={name}
          placeholder="Новая группа"
          aria-label="Новая группа"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Создаю…" : "Создать"}
        </Button>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
