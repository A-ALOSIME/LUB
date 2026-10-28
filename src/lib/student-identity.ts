export const studentMajors = [
  "نظم معلومات",
  "تقنية معلومات",
  "علوم حاسب",
] as const;
export const studentMajorsEn = [
  "Information Systems",
  "Information Technology",
  "Computer Science",
] as const;

export function normalizeMajor(value: string) {
  const key = value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670ـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, "");
  if (
    [
      "نظممعلومات",
      "نظمالمعلومات",
      "نظمالمعلوماتالاداريه",
      "informationsystems",
      "managementinformationsystems",
      "is",
      "mis",
    ].includes(key)
  )
    return studentMajors[0];
  if (
    [
      "تقنيهمعلومات",
      "تقنيهالمعلومات",
      "تكنولوجيامعلومات",
      "تكنولوجياالمعلومات",
      "informationtechnology",
      "it",
    ].includes(key)
  )
    return studentMajors[1];
  if (
    [
      "علومحاسب",
      "علومالحاسب",
      "علومالحاسبالالي",
      "علومالحاسوب",
      "computerscience",
      "cs",
    ].includes(key)
  )
    return studentMajors[2];
  return "";
}

// Format only; uniqueness is enforced separately on the encrypted identifier lookup.
export function validNationalId(value: string) {
  return /^[12][0-9]{9}$/.test(value);
}
