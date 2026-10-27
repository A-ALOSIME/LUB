const latin: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "a",
  آ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "h",
  و: "w",
  ؤ: "w",
  ي: "y",
  ى: "y",
  ئ: "y",
  ء: "",
};
export function suggestOrganizationSlug(name: string) {
  if (!name.trim()) return "";
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f\u064b-\u065f\u0670ـ]/g, "")
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
      .replace(/[\u0621-\u064a]/g, (c) => latin[c] ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80)
      .replace(/-$/, "") || "organization"
  );
}
