export const appTimeZone = "America/New_York";

export function newYorkDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
