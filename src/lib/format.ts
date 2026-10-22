import { appTimeZone } from "./moscow-time";

const numberFormat = new Intl.NumberFormat("ru-RU");
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

export function formatTons(value: number) {
  return `${formatNumber(value)} т`;
}

export function formatCubicMeters(value: number) {
  return `${formatNumber(value)} м³`;
}
