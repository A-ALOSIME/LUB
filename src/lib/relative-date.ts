import type { Locale } from "./preferences";
export function relativeDate(value: string, locale: Locale = "ar") {
  const days = Math.min(
    0,
    Math.round((new Date(value).getTime() - Date.now()) / 86400000),
  );
  return new Intl.RelativeTimeFormat(
    locale === "en" ? "en" : "ar-SA-u-nu-arab",
    { numeric: "auto" },
  ).format(days, "day");
}
