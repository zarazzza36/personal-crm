import { sql } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { bodyTypes } from "../lib/body-types";
import { contactFrequencies } from "../lib/contact-frequency";

export const bodyTypeEnum = pgEnum("body_type", bodyTypes);

export const contactFrequencyEnum = pgEnum("contact_frequency", contactFrequencies);

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
  // How often to talk to the contact; null when not set.
  contactFrequency: contactFrequencyEnum("contact_frequency"),
  // When the current frequency was set: the countdown starts here until the first note.
  contactFrequencySetAt: timestamp("contact_frequency_set_at", { withTimezone: true }),
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
    index("notes_remind_at_idx")
      .on(table.remindAt)
      .where(sql`${table.remindAt} is not null`),
  ],
);

// A circle of people the user makes up: "Семья", "Теннис".
export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Two groups never differ only by case. The expression uses the Russian collation, so
    // "Теннис" and "теннис" match on any server, whatever locale its database was made with.
    uniqueIndex("groups_name_key").on(sql`lower(${table.name} collate "ru-x-icu")`),
  ],
);

// Who is in which group; a contact is in any number of groups. Deleting a contact or a group
// deletes its rows here, and nothing else.
export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.groupId] }),
    // The key serves the contact's groups; this one serves the group's contacts.
    index("contact_groups_group_id_idx").on(table.groupId),
  ],
);
