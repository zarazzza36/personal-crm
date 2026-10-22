"use client";

import {
  startTransition,
  useActionState,
  useId,
  useLayoutEffect,
  useState,
  useTransition,
} from "react";
import { BellIcon } from "lucide-react";

import { removeNoteReminder, setNoteReminder } from "@/app/actions";
import { useReloadReminders } from "@/components/reminders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toMoscowInput } from "@/lib/moscow-time";
import { cn } from "@/lib/utils";

const HOUR_MS = 60 * 60 * 1000;

type FormState = { date: string; time: string; error?: string };

/** "Напомнить" next to a note: sets, moves or removes the note's only reminder. */
export function ReminderButton({ noteId, remindAt }: { noteId: number; remindAt: Date | null }) {
  const [open, setOpen] = useState(false);

  // Next.js keeps a page mounted after the user leaves it:
  // coming back to the card must never show the dialog already open.
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <BellIcon data-icon="inline-start" />
        Напомнить
      </DialogTrigger>
      <DialogContent className="max-h-dialog overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Напоминание</DialogTitle>
        </DialogHeader>
        <ReminderForm noteId={noteId} remindAt={remindAt} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ReminderForm({
  noteId,
  remindAt,
  onDone,
}: {
  noteId: number;
  remindAt: Date | null;
  onDone: () => void;
}) {
  const reloadReminders = useReloadReminders();
  const id = useId();
  const errorId = `${id}-error`;

  // Taken as the dialog opens: the reminder's own time, or an hour from now, in Moscow time.
  const [initial] = useState<FormState>(() =>
    toMoscowInput(remindAt ?? new Date(Date.now() + HOUR_MS)),
  );

  const [{ date, time, error }, formAction, isSaving] = useActionState(
    async (_previous: FormState, formData: FormData): Promise<FormState> => {
      const submitted = {
        date: String(formData.get("date") ?? ""),
        time: String(formData.get("time") ?? ""),
      };
      const result = await setNoteReminder(noteId, submitted);
      // On failure keep what was typed: the form resets its fields after an action.
      if (!result.ok) {
        return { ...submitted, error: result.error };
      }

      reloadReminders();
      startTransition(onDone);
      return submitted;
    },
    initial,
  );

  const [isRemoving, startRemoving] = useTransition();
  const busy = isSaving || isRemoving;

  function remove() {
    startRemoving(async () => {
      await removeNoteReminder(noteId);
      reloadReminders();
      onDone();
    });
  }

  const invalid = error ? true : undefined;
  const describedBy = error ? errorId : undefined;

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-date`}>Дата</Label>
          <Input
            id={`${id}-date`}
            name="date"
            type="date"
            defaultValue={date}
            required
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-time`}>Время</Label>
          {/* step 1: hours, minutes and seconds */}
          <Input
            id={`${id}-time`}
            name="time"
            type="time"
            step={1}
            defaultValue={time}
            required
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        </div>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter className={cn(remindAt && "sm:justify-between")}>
        {remindAt && (
          <Button type="button" variant="destructive" disabled={busy} onClick={remove}>
            {isRemoving ? "Убираю…" : "Убрать напоминание"}
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {isSaving ? "Сохраняю…" : "Сохранить"}
        </Button>
      </DialogFooter>
    </form>
  );
}
