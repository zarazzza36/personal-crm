const numberFormat = new Intl.NumberFormat("ru-RU");
const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}
