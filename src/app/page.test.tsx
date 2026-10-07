import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const preferences = vi.hoisted(() => ({ locale: "ar" as "ar" | "en" }));
vi.mock("@/lib/preferences", () => ({ getPreferences: async () => ({ locale: preferences.locale, theme: "dark" }) }));
vi.mock("@/components/public-header", () => ({ PublicHeader: () => null }));

import Home from "./page";

it("keeps the existing Arabic home content and includes a compact About section", async () => {
  preferences.locale = "ar";
  const html = renderToStaticMarkup(await Home());

  expect(html).toContain("هنا تبدأ مشاركتك");
  expect(html).toContain("لُبّ (LUB) منصة طلابية تساعد طلاب كلية علوم الحاسب والمعلومات بجامعة الإمام محمد بن سعود الإسلامية على اكتشاف الأندية والمجالس والفعاليات.");
  expect(html).toContain("مسار واضح لكل مشاركة");
  expect(html).toContain('id="about"');
  expect(html).toContain("عن لُبّ");
  expect(html).toContain("تقدر تتصفح معلومات الأندية والمجالس والفعاليات المنشورة بدون حساب.");
  expect(html).toContain('href="https://units.imamu.edu.sa/colleges/ComputerAndInformation/Pages/default.aspx"');
  expect(html).toContain('"alternateName":["LUB","Lub","lub.community"]');
  expect(html).toContain("أنت تختار ما تشاركه");
});

it("includes the equivalent English About section", async () => {
  preferences.locale = "en";
  const html = renderToStaticMarkup(await Home());

  expect(html).toContain("Start here.");
  expect(html).toContain("LUB (لُبّ) is a student platform for clubs, councils, and events at the College of Computer and Information Sciences, Imam Mohammad Ibn Saud Islamic University.");
  expect(html).toContain("About LUB");
  expect(html).toContain('"alternateName":["لُبّ","Lub","lub.community"]');
  expect(html).toContain("Public club, council, and event information can be browsed without an account.");
  expect(html).toContain("Official college website");
});
