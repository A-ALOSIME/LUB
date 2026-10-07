import { expect, it, vi } from "vitest";

const preferences = vi.hoisted(() => ({ locale: "ar" as "ar" | "en" }));
vi.mock("@/lib/preferences", () => ({ getPreferences: async () => ({ locale: preferences.locale, theme: "dark" }) }));
vi.mock("@/features/ai/chat-widget", () => ({ ChatWidget: () => null }));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "font" }) }));

import { generateMetadata } from "./layout";

it("describes LUB as a student clubs platform in Arabic metadata", async () => {
  preferences.locale = "ar";
  const metadata = await generateMetadata();

  expect(metadata.title).toEqual({ default: "لُبّ | منصة الأندية الطلابية", template: "%s | لُبّ" });
  expect(metadata.description).toContain("الأندية والمجالس الطلابية والفعاليات");
  expect(metadata.description).toContain("جامعة الإمام محمد بن سعود الإسلامية");
  expect(metadata.robots).toEqual({ index: true, follow: true });
});

it("describes LUB as a student clubs platform in English metadata", async () => {
  preferences.locale = "en";
  const metadata = await generateMetadata();

  expect(metadata.title).toEqual({ default: "LUB | Student Clubs and Events", template: "%s | LUB" });
  expect(metadata.description).toContain("student clubs, councils, and events");
  expect(metadata.description).toContain("Imam Mohammad Ibn Saud Islamic University");
});
