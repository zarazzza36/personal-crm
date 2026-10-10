import { z } from "zod";

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `Не длиннее ${maxLength} символов`)
    .transform((value) => (value === "" ? null : value));

export const contactIdSchema = z.number().int().positive();

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(200, "Не длиннее 200 символов"),
  about: optionalText(500),
  howWeMet: optionalText(500),
  phone: optionalText(50),
  email: optionalText(254).refine(
    (value) => value === null || /^\S+@\S+\.\S+$/.test(value),
    "Проверьте адрес почты",
  ),
});

export const noteInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Напишите текст заметки")
    .max(5000, "Не длиннее 5000 символов"),
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
