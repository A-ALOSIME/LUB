import type { Metadata } from "next";
import localFont from "next/font/local";
import { getPreferences } from "@/lib/preferences";
import "./globals.css";

const thmanyahSans = localFont({
  src: [
    { path: "../assets/fonts/thmanyahsans-regular.woff2", weight: "400" },
    { path: "../assets/fonts/thmanyahsans-bold.woff2", weight: "700" },
  ],
  variable: "--font-thmanyah-sans",
  display: "swap",
});
const thmanyahDisplay = localFont({
  src: "../assets/fonts/thmanyahdisplay-bold.woff2",
  variable: "--font-thmanyah-display",
  display: "swap",
});

// Each response receives a fresh CSP nonce; never cache nonce-bearing HTML.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getPreferences();
  const en = locale === "en";
  const title = en ? "LUB | Student life" : "لُبّ | مساحة العمل الطلابي";
  const description = en
    ? "Discover student clubs and councils, join activities, track hours and share achievements."
    : "مساحة الأندية والمجالس الطلابية، من العضوية والمشاركة إلى الساعات والإنجازات.";
  return {
    metadataBase: new URL("https://lub.community"),
    title: { default: title, template: en ? "%s | LUB" : "%s | لُبّ" },
    description,
    icons: { icon: [{ url: "/favicon.ico", sizes: "any", type: "image/x-icon" }] },
    openGraph: {
      type: "website",
      siteName: "لُبّ",
      locale: en ? "en_US" : "ar_SA",
      title,
      description,
      images: [{ url: "/brand/share-card.png", width: 1200, height: 630, alt: en ? "LUB logo" : "شعار لُبّ" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/brand/share-card.png"] },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, theme } = await getPreferences();
  return <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} data-theme={theme} className={`${thmanyahSans.variable} ${thmanyahDisplay.variable}`}><body className="min-h-screen antialiased">
    <a href="#main" className="fixed start-4 top-4 z-50 -translate-y-32 rounded-lg bg-white p-4 text-ink focus:translate-y-0">{locale === "ar" ? "تخطي إلى المحتوى" : "Skip to content"}</a>
    {children}
  </body></html>;
}
