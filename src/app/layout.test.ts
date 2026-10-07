import { expect, it, vi } from "vitest";

const preferences = vi.hoisted(() => ({ locale: "ar" as "ar" | "en" }));
vi.mock("@/lib/preferences", () => ({ getPreferences: async () => ({ locale: preferences.locale, theme: "dark" }) }));
vi.mock("@/features/ai/chat-widget", () => ({ ChatWidget: () => null }));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "font" }) }));

import { generateMetadata } from "./layout";

it("describes LUB as a student clubs platform in Arabic metadata", async () => {
  preferences.locale = "ar";
  const metadata = await generateMetadata();

  expect(metadata.title).toEqual({ default: "لُبّ (LUB) | أندية كلية علوم الحاسب والمعلومات", template: "%s | لُبّ" });
  expect(metadata.description).toBe("لُبّ (LUB) منصة طلابية تساعد طلاب كلية علوم الحاسب والمعلومات بجامعة الإمام محمد بن سعود الإسلامية على اكتشاف الأندية والمجالس والفعاليات.");
  expect(metadata.robots).toEqual({ index: true, follow: true });
});

it("describes LUB as a student clubs platform in English metadata", async () => {
  preferences.locale = "en";
  const metadata = await generateMetadata();

  expect(metadata.title).toEqual({ default: "LUB (لُبّ) | Student Clubs at the College of Computer and Information Sciences", template: "%s | LUB" });
  expect(metadata.description).toBe("LUB (لُبّ) is a student platform for clubs, councils, and events at the College of Computer and Information Sciences, Imam Mohammad Ibn Saud Islamic University.");
});
