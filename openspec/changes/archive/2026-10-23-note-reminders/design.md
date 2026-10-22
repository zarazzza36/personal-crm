## Context

Notes live in the `notes` table and are shown on the contact page (`src/app/contacts/[id]/page.tsx`), newest first. The browser never talks to the database: data goes through server actions in `src/app/actions.ts`. The app has no notifications yet; the product spec listed them under "Не делать", and this change narrows that to notifications outside the app.

The production container runs in UTC, and `formatDateTime` in `src/lib/format.ts` has no time zone, so note creation times on the site are 3 hours behind Moscow. The user always thinks in Moscow time, whatever the device's time zone.

## Goals / Non-Goals

**Goals:**

- One reminder per note: set, change, remove
- A notification in the top-left corner of every page when the reminder is due, kept until closed
- Reminders that came due while the app was closed show up on the next visit

**Non-Goals:**

- System notifications of the browser or OS, push, e-mail, sound
- Repeating reminders, snoozing, a list of all reminders
- Reminders on a contact rather than on a note

## Decisions

### One nullable column on `notes`

`notes.remind_at timestamptz null`: null means no reminder. Removing a reminder and closing its notification both set it back to null, so a closed reminder frees the note for a new one. A separate `reminders` table would only pay off with several reminders per note, which the spec rules out.

A partial index `notes_remind_at_idx on notes (remind_at) where remind_at is not null` keeps the reminders query cheap however many notes there are: every open tab runs it every 15 seconds.

### Moscow time everywhere

One constant, `appTimeZone = "Europe/Moscow"`, in `src/lib`. Every date formatter passes it as `timeZone`, so the server and the browser print the same Moscow time whatever their own zones are; this also fixes the note creation time. The reminder time on a note is then rendered on the server like the rest of the card.

The dialog sends the date and time exactly as typed (`2026-10-23`, `14:30:15`). The server reads them as Moscow wall time and turns them into an instant, stored as `timestamptz`. The dialog's defaults are an hour from now or the existing reminder, both printed in Moscow time. Due notifications compare instants with `Date.now()`, so the device's zone plays no part.

### Validation on the server

A zod schema checks the date and time formats, builds the instant and rejects one that is not later than the server's current time with "Это время уже прошло — выберите время в будущем". Empty fields are stopped by the browser with `required`. The device and server clocks may differ by a few seconds; that only matters for a time chosen a few seconds ahead.

### Server actions

- `setNoteReminder(noteId, date, time)`: validates Moscow date and time, stores the instant, refreshes the page
- `removeNoteReminder(noteId)`: clears the time, refreshes the page
- `dismissReminder(noteId, remindAt)`: clears the time only if it still equals `remindAt`. If the reminder was moved to a new time in another tab meanwhile, closing the old notification does not wipe the new one
- `loadReminders()`: every note with a reminder, due or not, with the contact's id and name and the first 300 characters of the note, ordered by time

### Notifications live in the root layout

A client component `Reminders` sits in `src/app/layout.tsx`, so it is on every page and survives navigation. A context provider around the page lets the reminder dialog ask it to reload right after a save, so the notification in the same tab comes on the second.

It keeps the list from `loadReminders()` and reloads it on mount, every 15 seconds, and when the tab becomes visible again. A timer set to the nearest future reminder moves it into the shown stack when its time comes; reminders already due on load show at once. Closing a notification hides it immediately and calls `dismissReminder`; other tabs drop it on their next reload. Deleting a contact reloads the reminders right after the deletion: otherwise a reminder of its notes due before the next reload would still show.

The stack is fixed to the top-left corner with the page's 16px gutter, at most 360px wide, oldest due on top, scrolling inside if it gets taller than the screen. It is an `aria-live="polite"` region, so screen readers announce new notifications. Colours, fonts and spacing come from the existing design tokens.

### The dialog

`ReminderButton` next to each note opens a dialog built on the existing `Dialog` from `src/components/ui`. Fields: `<input type="date">` and `<input type="time" step="1">` (hours, minutes, seconds), both native: no new library. Defaults are taken when the dialog opens: the existing reminder or an hour from now, both in Moscow time, so the defaults can be saved as they are. "Убрать напоминание" shows only when the note has a reminder.

## Risks / Trade-offs

- A tab in the background may be slowed down by the browser to about one timer per minute → its notification may come up to a minute late, but it is on screen when the user looks at the tab
- A reminder set in another browser reaches this one within 15 seconds → acceptable for a personal CRM; the tab where it was set fires on the second
- A wrong clock on the device fires the notification at the wrong time → accepted; the device's time zone, unlike its clock, does not matter
- The user cannot pick a time in another zone → by design: the user always works in Moscow time
- Polling every 15 seconds per open tab → one small indexed query, negligible for one user
- There are no automated tests in the project; adding a test framework is a new library → acceptance is checked by hand in the browser, scenario by scenario

## Migration Plan

- `pnpm db:generate` creates `drizzle/0002_*.sql`: add the nullable column and the partial index. Existing notes get null, nothing else changes
- On the server the migration runs before the new image starts, as for every release
- Rollback: `rollback.sh` brings back the previous image; it does not know the column and ignores it. The migration is not undone

## Open Questions

- none
