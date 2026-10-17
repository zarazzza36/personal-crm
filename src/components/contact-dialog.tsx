"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon } from "lucide-react";

import { createContact, updateContact } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bodyTypeLabels, bodyTypes, type BodyType } from "@/lib/body-types";
import {
  contactFormFields,
  type ContactFormErrors,
  type ContactFormValues,
} from "@/lib/contact-input";

type EditableContact = {
  id: number;
  name: string;
  about: string | null;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
  capacityTons: number | null;
  volumeCubicMeters: number | null;
  bodyType: BodyType | null;
};

type FormState = { values: ContactFormValues; errors: ContactFormErrors };

const emptyValues: ContactFormValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  capacityTons: "",
  volumeCubicMeters: "",
  bodyType: "",
};

// The form shows a decimal comma, as people write it: "1,5".
function amountToText(value: number | null) {
  return value === null ? "" : String(value).replace(".", ",");
}

export function AddContactButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        <span>
          Добавить<span className="hidden sm:inline"> контакт</span>
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-dialog overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый контакт</DialogTitle>
        </DialogHeader>
        <ContactForm onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EditContactButton({ contact }: { contact: EditableContact }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <PencilIcon data-icon="inline-start" />
        Изменить
      </DialogTrigger>
      <DialogContent className="max-h-dialog overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Изменить контакт</DialogTitle>
        </DialogHeader>
        <ContactForm contact={contact} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ContactForm({ contact, onSaved }: { contact?: EditableContact; onSaved: () => void }) {
  const router = useRouter();

  const [{ values, errors }, formAction, isPending] = useActionState(
    async (_previous: FormState, formData: FormData): Promise<FormState> => {
      const submitted = { ...emptyValues };
      for (const field of contactFormFields) {
        submitted[field] = String(formData.get(field) ?? "");
      }

      const result = contact
        ? await updateContact(contact.id, submitted)
        : await createContact(submitted);
      if (!result.ok) {
        return { values: submitted, errors: result.errors };
      }

      startTransition(onSaved);
      if (!contact) {
        // Show the full list with the new contact highlighted.
        router.replace(`/?added=${result.id}`, { scroll: false });
      }
      return { values: submitted, errors: {} };
    },
    {
      values: contact
        ? {
            name: contact.name,
            about: contact.about ?? "",
            howWeMet: contact.howWeMet ?? "",
            phone: contact.phone ?? "",
            email: contact.email ?? "",
            capacityTons: amountToText(contact.capacityTons),
            volumeCubicMeters: amountToText(contact.volumeCubicMeters),
            bodyType: contact.bodyType ?? "",
          }
        : emptyValues,
      errors: {},
    },
  );

  return (
    <form action={formAction} autoComplete="off" className="grid gap-4">
      <Field
        name="name"
        label="Имя"
        placeholder="Иван Петров"
        defaultValue={values.name}
        error={errors.name}
        required
      />
      <Field
        name="about"
        label="Кто это"
        placeholder="Дизайнер, сосед, друг брата"
        defaultValue={values.about}
        error={errors.about}
      />
      <Field
        name="howWeMet"
        label="Откуда знакомы"
        placeholder="Учились вместе, познакомились на конференции"
        defaultValue={values.howWeMet}
        error={errors.howWeMet}
      />
      <Field
        name="phone"
        label="Телефон"
        type="tel"
        placeholder="+7 900 000-00-00"
        defaultValue={values.phone}
        error={errors.phone}
      />
      <Field
        name="email"
        label="Почта"
        inputMode="email"
        placeholder="ivan@example.com"
        defaultValue={values.email}
        error={errors.email}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          name="capacityTons"
          label="Тонны"
          inputMode="decimal"
          placeholder="1,5"
          defaultValue={values.capacityTons}
          error={errors.capacityTons}
        />
        <Field
          name="volumeCubicMeters"
          label="Кубы"
          inputMode="decimal"
          placeholder="16"
          defaultValue={values.volumeCubicMeters}
          error={errors.volumeCubicMeters}
        />
      </div>
      <BodyTypeField defaultValue={values.bodyType} error={errors.bodyType} />
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Отмена</DialogClose>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Сохраняю…" : "Сохранить"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  ...inputProps
}: { name: keyof ContactFormValues; label: string; error?: string } & Omit<
  React.ComponentProps<typeof Input>,
  "name" | "id"
>) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// "Не указан" clears the choice: the form then sends an empty value, as for an empty field.
const bodyTypeItems = [
  { value: null, label: "Не указан" },
  ...bodyTypes.map((type) => ({ value: type, label: bodyTypeLabels[type] })),
];

// Not the browser's own list: that one opens light on Windows, with the light text unreadable.
function BodyTypeField({ defaultValue, error }: { defaultValue: string; error?: string }) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Тип кузова</Label>
      <Select name="bodyType" items={bodyTypeItems} defaultValue={defaultValue || null}>
        <SelectTrigger
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full"
        >
          <SelectValue placeholder="Не указан" />
        </SelectTrigger>
        {/* Opens below the field, or above it when there is more room there:
            the whole list fits even near the bottom of a short screen. */}
        <SelectContent alignItemWithTrigger={false}>
          {bodyTypeItems.map((item) => (
            <SelectItem key={item.value ?? "none"} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
