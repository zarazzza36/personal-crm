import { sql } from "drizzle-orm";
import { index, integer, numeric, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { bodyTypes } from "../lib/body-types";

export const bodyTypeEnum = pgEnum("body_type", bodyTypes);

export const contacts = pgTable("contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  // Who this person is: job, role in my life.
  about: text("about"),
  howWeMet: text("how_we_met"),
  phone: text("phone"),
  email: text("email"),
  // The contact's truck, if they have one.
  capacityTons: numeric("capacity_tons", { precision: 6, scale: 2, mode: "number" }),
  volumeCubicMeters: numeric("volume_cubic_meters", { precision: 6, scale: 2, mode: "number" }),
  bodyType: bodyTypeEnum("body_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notes = pgTable(
  "notes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // When to remind about the note; null when there is no reminder.
    remindAt: timestamp("remind_at", { withTimezone: true }),
  },
  (table) => [
    index("notes_contact_id_idx").on(table.contactId),
    // Every open tab asks for the notes with a reminder every 15 seconds.
    index("notes_remind_at_idx").on(table.remindAt).where(sql`${table.remindAt} is not null`),
  ],
);
