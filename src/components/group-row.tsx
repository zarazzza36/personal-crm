"use client";

import {
  useActionState,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { deleteGroup, renameGroup } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatContactCount } from "@/lib/format";
import type { GroupListItem } from "@/lib/groups";

/** A group on the page "Группы": its name and the number of contacts, "Переименовать", "Удалить". */
export function GroupRow({ group }: { group: GroupListItem }) {
  const [isRenaming, setIsRenaming] = useState(false);

  // Next.js keeps a page mounted after the user leaves it: coming back must never show
  // the name already in the middle of being edited.
  useLayoutEffect(() => () => setIsRenaming(false), []);

  return (
    <li className="py-4">
      {isRenaming ? (
        <RenameForm group={group} onDone={() => setIsRenaming(false)} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="min-w-0 break-words">
            <span className="font-display text-15 font-medium">{group.name}</span>
            <span className="text-13 text-muted-foreground">
              {" · "}
              {formatContactCount(group.contactCount)}
            </span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsRenaming(true)}>
              <PencilIcon data-icon="inline-start" />
              Переименовать
            </Button>
            <DeleteGroupButton group={group} />
          </div>
        </div>
      )}
    </li>
  );
}

type RenameState = { name: string; error?: string };

function RenameForm({ group, onDone }: { group: GroupListItem; onDone: () => void }) {
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [{ name, error }, formAction, isPending] = useActionState(
    async (_previous: RenameState, formData: FormData): Promise<RenameState> => {
      const submitted = String(formData.get("name") ?? "");
      const result = await renameGroup(group.id, submitted);
      if (result.ok) {
        onDone();
        return { name: submitted };
      }
      // On failure keep the text so nothing typed is lost.
      return { name: submitted, error: result.error };
    },
    { name: group.name },
  );

  // The name is ready to be replaced: selected, with the cursor in the field.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <form
      action={formAction}
      autoComplete="off"
      onKeyDown={(event) => {
        if (event.key === "Escape") onDone();
      }}
      className="grid gap-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={inputRef}
          name="name"
          defaultValue={name}
          aria-label={`Новое название группы «${group.name}»`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Сохраняю…" : "Сохранить"}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            Отмена
          </Button>
        </div>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function DeleteGroupButton({ group }: { group: GroupListItem }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Next.js keeps a page mounted after the user leaves it:
  // coming back to the page must never show this question already open.
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        <Trash2Icon data-icon="inline-start" />
        Удалить
      </AlertDialogTrigger>
      {/* Focus starts on "Отмена", so an accidental Enter does not delete the group. */}
      <AlertDialogContent size="sm" initialFocus={cancelRef}>
        <AlertDialogHeader>
          {/* A long name without spaces breaks anywhere instead of widening the window. */}
          <AlertDialogTitle className="wrap-anywhere">Удалить группу «{group.name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Контакты останутся, они просто выйдут из группы.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await deleteGroup(group.id);
                setOpen(false);
              })
            }
          >
            {isPending ? "Удаляю…" : "Удалить"}
          </AlertDialogAction>
          <AlertDialogCancel ref={cancelRef} disabled={isPending}>
            Отмена
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
