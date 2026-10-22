import { z } from "zod";

/** How often an open tab asks for reminders set or closed in another tab or browser. */
export const REMINDERS_RELOAD_MS = 15_000;

/** How many characters of the note a notification gets: it shows the first lines. */
export const NOTE_EXCERPT_LENGTH = 300;

/** A note's reminder, due or still ahead. */
export type Reminder = {
  noteId: number;
  remindAt: Date;
  contactId: number;
  contactName: string;
  noteExcerpt: string;
};

/** The reminder's moment as the browser sends it back: milliseconds since 1970. */
export const reminderMomentSchema = z
  .number()
  .int()
  .positive()
  .transform((ms) => new Date(ms));
