import type { Locale } from "./preferences";

export function formatHours(value: string | number, locale: Locale = "ar") {
  const n = Number(value),
    number = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(n);
  if (locale === "en") return `${number} ${n === 1 ? "hour" : "hours"}`;
  if (n === 1) return "ساعة واحدة";
  if (n === 2) return "ساعتان";
  return `${number} ${Number.isInteger(n) && n >= 3 && n <= 10 ? "ساعات" : "ساعة"}`;
}

export function academicLevel(
  value: string | null | undefined,
  locale: Locale = "ar",
) {
  if (!value) return locale === "en" ? "Level not set" : "المستوى غير محدد";
  if (value === "graduate") return locale === "en" ? "Graduate" : "دراسات عليا";
  const levels = [
    "الأول",
    "الثاني",
    "الثالث",
    "الرابع",
    "الخامس",
    "السادس",
    "السابع",
    "الثامن",
    "التاسع",
    "العاشر",
    "الحادي عشر",
    "الثاني عشر",
  ];
  const wordIndex=levels.indexOf(value.replace(/^المستوى\s*/,""));
  if(wordIndex>=0)return locale==="en"?`Level ${wordIndex+1}`:`المستوى ${levels[wordIndex]}`;
  const n = Number(value.replace(/^المستوى\s*/, ""));
  return levels[n - 1]
    ? locale === "en"
      ? `Level ${n}`
      : `المستوى ${levels[n - 1]}`
    : value;
}

export function academicTerm(value: string, locale: Locale = "ar") {
  if (locale === "en") return value;
  return value
    .replace(
      /(?:الترم|الفصل(?: الدراسي)?)\s*(?:الاول|الأول|1)/g,
      "الفصل الدراسي الأول",
    )
    .replace(
      /(?:الترم|الفصل(?: الدراسي)?)\s*(?:الثاني|2)/g,
      "الفصل الدراسي الثاني",
    )
    .replace(
      /(?:الترم|الفصل(?: الدراسي)?)\s*(?:الثالث|3)/g,
      "الفصل الدراسي الثالث",
    );
}

export function recordCount(count: number, locale: Locale = "ar") {
  return locale === "en"
    ? `${count} ${count === 1 ? "record" : "records"}`
    : count === 1
      ? "سجل واحد"
      : count === 2
        ? "سجلان"
        : `${count} ${count >= 3 && count <= 10 ? "سجلات" : "سجلًا"}`;
}
