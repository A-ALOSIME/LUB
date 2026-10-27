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

// Saudi Health Council, IS0001 Appendix B: ten digits, type 1/2, check digit.
// This validates format/checksum; it does not claim to verify a person's identity.
export function validNationalId(value: string) {
  if (!/^[12][0-9]{9}$/.test(value)) return false;
  const sum = Array.from(value).reduce((total, digit, index) => {
    const n = Number(digit) * (index % 2 === 0 ? 2 : 1);
    return total + (n > 9 ? n - 9 : n);
  }, 0);
  return sum % 10 === 0;
}
