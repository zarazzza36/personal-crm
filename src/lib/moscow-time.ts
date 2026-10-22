/** The user always thinks in Moscow time: dates are shown and typed in it whatever the device's zone. */
export const appTimeZone = "Europe/Moscow";

// h23 gives "00", not "24", at midnight.
const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: appTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type Part = "year" | "month" | "day" | "hour" | "minute" | "second";

function moscowParts(date: Date) {
  const parts = partsFormat.formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value])) as Record<Part, string>;
}

/** How far Moscow clocks are ahead of UTC at `date`, in milliseconds. */
function moscowOffset(date: Date) {
  const p = moscowParts(date);
  const wallClock = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wallClock - Math.floor(date.getTime() / 1000) * 1000;
}

/** The date and time as date and time inputs take them, in Moscow time: "2026-10-23" and "14:30:15". */
export function toMoscowInput(date: Date) {
  const p = moscowParts(date);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` };
}

/**
 * The moment Moscow clocks show `date` ("2026-10-23") and `time` ("14:30:15", or "14:30" as
 * a time input gives it at zero seconds); null if there is no such date or time.
 */
export function fromMoscowInput(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [year, month, day] = dateMatch.slice(1).map(Number);
  const [hour, minute, second] = timeMatch.slice(1).map((value) => Number(value ?? 0));
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  const moment = new Date(wallClock - moscowOffset(new Date(wallClock)));

  // Date.UTC rolls "2026-02-30" and "25:00" over into another day: such input has no moment.
  const roundTrip = toMoscowInput(moment);
  const typed = { date, time: timeMatch[3] === undefined ? `${time}:00` : time };
  return roundTrip.date === typed.date && roundTrip.time === typed.time ? moment : null;
}
