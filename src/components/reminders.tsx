"use client";

import { createContext, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellIcon, XIcon } from "lucide-react";

import { dismissReminder, loadReminders } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { REMINDERS_RELOAD_MS, type Reminder } from "@/lib/reminders";

// The longest delay setTimeout takes; a longer one fires at once.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** Lets the reminder dialog show its change at once, not on the next reload. */
const ReloadRemindersContext = createContext<() => void>(() => {});

export function useReloadReminders() {
  return use(ReloadRemindersContext);
}

// A reminder moved to another time is a new one: its notification shows again.
function reminderKey(reminder: Reminder) {
  return `${reminder.noteId}:${reminder.remindAt.getTime()}`;
}

/**
 * The pages with the notifications of due reminders over them, in the top-left corner.
 * A notification stays until it is closed, on every page and after a reload.
 */
export function Reminders({ children }: { children: React.ReactNode }) {
  // Sorted by time, so the earliest due notification is on top.
  const [reminders, setReminders] = useState<Reminder[]>([]);
  // The reminders due by this moment are shown.
  const [checkedAt, setCheckedAt] = useState(0);
  // Closed in this tab, hidden until a reload no longer brings them.
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

  const reload = useCallback(() => {
    loadReminders().then(
      (loaded) => {
        const keys = new Set(loaded.map(reminderKey));
        setReminders(loaded);
        setCheckedAt(Date.now());
        setClosed((previous) => new Set([...previous].filter((key) => keys.has(key))));
      },
      () => {
        // Offline, or a new version is starting on the server: keep what is shown, retry next time.
      },
    );
  }, []);

  // Reminders set or closed in another tab or browser come with a reload.
  useEffect(() => {
    reload();
    const interval = setInterval(reload, REMINDERS_RELOAD_MS);
    const reloadWhenShown = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", reloadWhenShown);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", reloadWhenShown);
    };
  }, [reload]);

  // Wakes up when the next reminder comes due, so it shows on the second.
  useEffect(() => {
    const next = reminders.find((reminder) => reminder.remindAt.getTime() > checkedAt);
    if (!next) return;
    const delay = Math.min(next.remindAt.getTime() - Date.now(), MAX_TIMEOUT_MS);
    const timer = setTimeout(() => setCheckedAt(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [reminders, checkedAt]);

  function close(reminder: Reminder) {
    const key = reminderKey(reminder);
    setClosed((previous) => new Set(previous).add(key));
    dismissReminder(reminder.noteId, reminder.remindAt.getTime()).catch(() => {
      // Not saved: show it again rather than lose the reminder without a word.
      setClosed((previous) => new Set([...previous].filter((closedKey) => closedKey !== key)));
    });
  }

  const due = reminders.filter(
    (reminder) => reminder.remindAt.getTime() <= checkedAt && !closed.has(reminderKey(reminder)),
  );

  return (
    <ReloadRemindersContext value={reload}>
      {children}
      {/* Always in the page, so screen readers announce what appears in it. The padding gives
          the shadows room; the empty corner lets clicks through to the logo under it. */}
      <section
        aria-label="Напоминания"
        aria-live="polite"
        className="pointer-events-none fixed top-0 left-0 z-40 grid max-h-dvh w-98 max-w-full gap-2.5 overflow-y-auto p-4"
      >
        {due.map((reminder) => (
          <Notification
            key={reminderKey(reminder)}
            reminder={reminder}
            onClose={() => close(reminder)}
          />
        ))}
      </section>
    </ReloadRemindersContext>
  );
}

function Notification({ reminder, onClose }: { reminder: Reminder; onClose: () => void }) {
  return (
    <div className="pointer-events-auto relative rounded-16 bg-asphalt py-4 pr-12 pl-4 shadow-hard ring-1 ring-foreground/12 animate-in fade-in-0 slide-in-from-left-4">
      <p className="flex items-center gap-1.5 text-11 tracking-label text-accent uppercase">
        <BellIcon aria-hidden className="size-3.5" />
        Напоминание
      </p>
      <p className="mt-1.5 font-heading text-15 font-bold tracking-heading break-words">
        {reminder.contactName}
      </p>
      <p className="mt-1 line-clamp-3 text-13 leading-normal break-words whitespace-pre-line text-muted-foreground">
        {reminder.noteExcerpt}
      </p>
      <Link
        href={`/contacts/${reminder.contactId}`}
        className="mt-2.5 inline-block rounded-sm text-13 text-accent underline underline-offset-4 outline-none hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Открыть карточку
      </Link>
      <Button variant="ghost" size="icon-sm" className="absolute top-2.5 right-2.5" onClick={onClose}>
        <XIcon />
        <span className="sr-only">Закрыть</span>
      </Button>
    </div>
  );
}
