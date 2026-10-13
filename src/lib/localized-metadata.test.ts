import { expect, it, vi } from "vitest";

vi.mock("./preferences", () => ({ getPreferences: vi.fn(async () => ({ locale: "ar", theme: "dark" })) }));

import { localizedMetadata } from "./localized-metadata";

it("keeps pages out of search by default", async () => {
  const metadata = await localizedMetadata("الحساب", "Account");

  expect(metadata.robots).toMatchObject({ index: false, follow: false });
});

it("builds localized public metadata with a canonical URL and social preview", async () => {
  const metadata = await localizedMetadata("الأندية والمجالس", "Clubs and councils", {}, {
    index: true,
    canonical: "/organizations",
    description: {
      ar: "اكتشف الأندية والمجالس الطلابية المنشورة في لُبّ.",
      en: "Discover student clubs and councils published on LUB.",
    },
  });

  expect(metadata).toMatchObject({
    title: "الأندية والمجالس",
    description: "اكتشف الأندية والمجالس الطلابية المنشورة في لُبّ.",
    alternates: { canonical: "/organizations" },
    robots: { index: true, follow: true },
  });
  expect(metadata.openGraph).toMatchObject({
    title: "الأندية والمجالس",
    description: "اكتشف الأندية والمجالس الطلابية المنشورة في لُبّ.",
    url: "https://lub.community/organizations",
  });
  expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
});
