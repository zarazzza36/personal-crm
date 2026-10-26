import { appTimeZone, toMoscowInput } from "./moscow-time";

const numberFormat = new Intl.NumberFormat("ru-RU");
const pluralRules = new Intl.PluralRules("ru-RU");
// "15 ноября": a day without time is taken as midnight UTC and shown in UTC,
// so it never moves to the day before or after.
const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
// "3 марта 2027 г."
const dayWithYearFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayWords: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "день",
  few: "дня",
  many: "дней",
};
// "22 октября 2026 г. в 18:40", in Moscow time on the server and in any browser.
const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: appTimeZone,
});
// "23 октября 2026 г. в 14:30:15": a reminder is set to the second.
const dateTimeWithSecondsFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: appTimeZone,
});

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}

export function formatDateTimeWithSeconds(date: Date) {
  return dateTimeWithSecondsFormat.format(date);
}

/** A day without time ("2026-11-15"): "15 ноября", with the year only when it is not this one. */
export function formatDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  const thisYear = toMoscowInput(new Date()).date.slice(0, 4);
  return (day.startsWith(thisYear) ? dayFormat : dayWithYearFormat).format(date);
}

/** "21 день", "22 дня", "25 дней". */
export function formatDays(count: number) {
  return `${formatNumber(count)} ${dayWords[pluralRules.select(count)] ?? "дня"}`;
}

export function formatTons(value: number) {
  return `${formatNumber(value)} т`;
}

export function formatCubicMeters(value: number) {
  return `${formatNumber(value)} м³`;
}
