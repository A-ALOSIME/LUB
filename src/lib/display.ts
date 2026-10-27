import type { Locale } from "./preferences";

const countFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits:2 });

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

export function formatCount(value: number | string, unit: keyof typeof countForms, locale: Locale = "ar", grammaticalCase: "nominative" | "oblique" = "nominative") {
  const count = Number(value), forms = countForms[unit];
  const number = countFormatter.format(count);
  if (locale === "en") return `${number} ${forms.en}${count === 1 ? "" : "s"}`;
  if (count === 0) return forms.zero;
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
  return formatCount(count, "records", locale);
}
