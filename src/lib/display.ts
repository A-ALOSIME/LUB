import {t as translateUi} from "@/lib/i18n";
import {normalizeMajor,studentMajors,studentMajorsEn} from "./student-identity";
import type { Locale } from "./preferences";

import {formatNumber} from "./i18n";

const countForms = {
  organizations:{one:"جهة واحدة",two:"جهتان",oblique:"جهتين",plural:"جهات",singular:"جهة",zero:"لا جهات",en:"organization"},
  events:{one:"فعالية واحدة",two:"فعاليتان",oblique:"فعاليتين",plural:"فعاليات",singular:"فعالية",zero:"لا فعاليات",en:"event"},
  applications: {one:"طلب واحد",two:"طلبان",oblique:"طلبين",plural:"طلبات",singular:"طلبًا",zero:"لا طلبات",en:"application"},
  registrants: {one:"مسجل واحد",two:"مسجلان",oblique:"مسجلين",plural:"مسجلين",singular:"مسجلًا",zero:"لا مسجلين",en:"registrant"},
  hours: { one:"ساعة واحدة", two:"ساعتان", oblique:"ساعتين", plural:"ساعات", singular:"ساعة", zero:"لا ساعات", en:"hour" },
  rounds: { one:"جولة واحدة", two:"جولتان", oblique:"جولتين", plural:"جولات", singular:"جولة", zero:"لا جولات", en:"round" },
  versions: { one:"نسخة واحدة", two:"نسختان", oblique:"نسختين", plural:"نسخ", singular:"نسخة", zero:"لا نسخ", en:"version" },
  records: { one:"سجل واحد", two:"سجلان", oblique:"سجلين", plural:"سجلات", singular:"سجلًا", zero:"لا سجلات", en:"record" },
  members: { one:"عضو واحد", two:"عضوان", oblique:"عضوين", plural:"أعضاء", singular:"عضوًا", zero:"لا أعضاء", en:"member" },
} as const;

export function formatCount(value: number | string, unit: keyof typeof countForms, locale: Locale = "ar", grammaticalCase: "nominative" | "oblique" = "nominative", zeroStyle: "words" | "number" = "words") {
  const count = Number(value), forms = countForms[unit];
  const number = formatNumber(count,locale);
  if (locale === "en") return `${number} ${forms.en}${count === 1 ? "" : "s"}`;
  if (count === 0) return zeroStyle === "number" ? `${number} ${unit === "hours" ? forms.singular : forms.plural}` : forms.zero;
  if (count === 1) return forms.one;
  if (count === 2) return grammaticalCase === "oblique" ? forms.oblique : forms.two;
  return `${number} ${Number.isInteger(count) && count >= 3 && count <= 10 ? forms.plural : forms.singular}`;
}

export function formatHours(value: string | number, locale: Locale = "ar") {
  return formatCount(value, "hours", locale);
}

export function academicLevel(
  value: string | null | undefined,
  locale: Locale = "ar",
) {
  if (!value) return translateUi((locale === "en") ? "en" : "ar", "المستوى غير محدد", "Level not set");
  if (value === "graduate") return translateUi((locale === "en") ? "en" : "ar", "دراسات عليا", "Graduate");
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
  if(wordIndex>=0)return translateUi((locale==="en") ? "en" : "ar", `المستوى ${levels[wordIndex]}`, `Level ${wordIndex+1}`);
  const n = Number(value.replace(/^المستوى\s*/, ""));
  return levels[n - 1]
    ? translateUi((locale === "en") ? "en" : "ar", `المستوى ${levels[n - 1]}`, `Level ${n}`)
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
  return formatCount(count, "records", locale);
}

export function majorLabel(value:string,locale:Locale="ar"){
 const index=studentMajors.indexOf(normalizeMajor(value) as typeof studentMajors[number]);
 return locale==="en"&&index>=0?studentMajorsEn[index]:value;
}
