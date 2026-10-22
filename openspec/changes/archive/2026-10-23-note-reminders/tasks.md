## 1. Data

- [x] 1.1 Add `remindAt` and the partial index `notes_remind_at_idx` to `notes` in `src/db/schema.ts`
- [x] 1.2 Generate the migration with `pnpm db:generate`, review the SQL, apply it locally

## 2. Server

- [x] 2.1 `appTimeZone` in `src/lib`; every date formatter prints Moscow time, the note creation time included
- [x] 2.2 Reminder time validation in `src/lib`: Moscow date and time → `Date`, later than now
- [x] 2.3 Query for all reminders with the contact name and the note excerpt in `src/db/queries.ts`
- [x] 2.4 Server actions `setNoteReminder`, `removeNoteReminder`, `dismissReminder`, `loadReminders`

## 3. Reminder on a note

- [x] 3.1 Reminder dialog: date and time fields with defaults, save, remove, error
- [x] 3.2 Reminder time on the note, in Moscow time
- [x] 3.3 Button and time next to every note on the contact page

## 4. Notifications

- [x] 4.1 `Reminders` in the root layout, with a context for the dialog: load, reload every 15 s and on tab focus, timer to the next reminder
- [x] 4.2 Notification stack in the top-left corner: contact name, note excerpt, link, close button
- [x] 4.3 The dialog reloads the notifications after a save or removal

## 5. Docs

- [x] 5.1 Narrow "уведомления" in "Не делать" of `specs/01-продуктовая-идея.md` to notifications outside the app
- [x] 5.2 Reminders in "Что умеет" of `README.md`
- [x] 5.3 Move the spec to `openspec/specs/note-reminders/spec.md` and archive the change

## 6. Check

- [x] 6.1 `pnpm lint` and `pnpm build` pass
- [x] 6.2 Every scenario of the spec walked through in Chrome against the local app; the other time zone one checked by script in UTC, Novosibirsk and New York time
