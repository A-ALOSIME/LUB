import type { Metadata } from "next";
import { getPreferences } from "./preferences";

const siteUrl = "https://lub.community";

export type LocalizedPublicMetadata = {
  index?: boolean;
  canonical: string;
  description: { ar: string; en: string };
};

export async function localizedMetadata(
  ar: string,
  en: string,
  rest: Metadata = {},
  publicPage?: LocalizedPublicMetadata,
): Promise<Metadata> {
  const { locale } = await getPreferences();
  const english = locale === "en";
  const title = english ? en : ar;
  const description = publicPage ? (english ? publicPage.description.en : publicPage.description.ar) : undefined;
  const canonical = publicPage?.canonical;
  const index = publicPage?.index ?? false;
  const robots = typeof rest.robots === "object" && rest.robots !== null ? rest.robots : {};

  return {
    ...rest,
    title,
    ...(description ? { description } : {}),
    alternates: {
      ...rest.alternates,
      ...(canonical ? { canonical } : {}),
    },
    robots: {
      ...robots,
      index,
      follow: index,
    },
    ...(publicPage ? {
      openGraph: {
        ...rest.openGraph,
        type: "website",
        siteName: english ? "LUB" : "لُبّ",
        locale: english ? "en_US" : "ar_SA",
        title,
        description,
        url: new URL(canonical!, siteUrl).toString(),
        images: rest.openGraph?.images ?? [{ url: "/brand/share-card.png", width: 1200, height: 630 }],
      },
      twitter: {
        ...rest.twitter,
        card: "summary_large_image",
        title,
        description,
        images: rest.twitter?.images ?? ["/brand/share-card.png"],
      },
    } : {}),
  };
}
