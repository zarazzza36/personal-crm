import { z } from "zod";

import { bodyTypes } from "./body-types";
import { fromMoscowInput } from "./moscow-time";

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `Не длиннее ${maxLength} символов`)
    .transform((value) => (value === "" ? null : value));

// The database keeps two decimal places: "1,5" and "82.25" fit, "1,555" does not.
const optionalAmount = (max: number) =>
  z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === "") return null;

      const normalized = value.replace(",", ".");
      if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
        context.addIssue({ code: "custom", message: "Укажите число, например 1,5" });
        return z.NEVER;
      }
      const amount = Number(normalized);
      if (amount <= 0 || amount > max) {
        context.addIssue({ code: "custom", message: `Больше нуля и не больше ${max}` });
        return z.NEVER;
      }
      return amount;
    });

export const contactIdSchema = z.number().int().positive();

/** Contact id taken from a URL; `null` unless it is a plain positive integer. */
export function parseContactId(value: string | undefined) {
  return value !== undefined && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : null;
}

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(200, "Не длиннее 200 символов"),
  about: optionalText(500),
  howWeMet: optionalText(500),
  phone: optionalText(50),
  email: optionalText(254).refine(
    (value) => value === null || /^\S+@\S+\.\S+$/.test(value),
    "Проверьте адрес почты",
  ),
  capacityTons: optionalAmount(999),
  volumeCubicMeters: optionalAmount(999),
  bodyType: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.enum(bodyTypes, "Выберите тип кузова из списка").nullable()),
});

export const noteInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Напишите текст заметки")
    .max(5000, "Не длиннее 5000 символов"),
});

export const noteIdSchema = z.number().int().positive();

/** Reminder date and time typed in Moscow time; parses to the moment, which must be ahead. */
export const reminderInputSchema = z
  .object({ date: z.string(), time: z.string() })
  .transform(({ date, time }, context) => {
    const remindAt = fromMoscowInput(date, time);
    if (!remindAt) {
      context.addIssue({ code: "custom", message: "Укажите дату и время" });
      return z.NEVER;
    }
    if (remindAt.getTime() <= Date.now()) {
      context.addIssue({
        code: "custom",
        message: "Это время уже прошло — выберите время в будущем",
      });
      return z.NEVER;
    }
    return remindAt;
  });

/** Raw contact form values, exactly as typed by the user. */
export type ContactFormValues = Record<keyof z.input<typeof contactInputSchema>, string>;

export type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>;

export const contactFormFields = Object.keys(
  contactInputSchema.shape,
) as (keyof ContactFormValues)[];

/** First error message per field, ready to show next to the inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    errors[field] ??= issue.message;
  }
  return errors;
}
