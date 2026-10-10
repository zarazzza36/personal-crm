"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";

import { deleteContact } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteContactButton({ contactId }: { contactId: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Next.js keeps a page mounted after the user leaves it:
  // coming back to the card must never show this question already open.
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        <Trash2Icon data-icon="inline-start" />
        Удалить
      </AlertDialogTrigger>
      {/* Focus starts on "Нет", so an accidental Enter does not delete the contact. */}
      <AlertDialogContent size="sm" initialFocus={cancelRef}>
        <AlertDialogHeader>
          <AlertDialogTitle>Контакт будет полностью удален, вы согласны?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() => startTransition(() => deleteContact(contactId))}
          >
            {isPending ? "Удаляю…" : "Да"}
          </AlertDialogAction>
          <AlertDialogCancel ref={cancelRef} disabled={isPending}>
            Нет
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
