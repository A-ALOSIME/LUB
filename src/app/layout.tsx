import {ActivityCacheProvider} from "@/features/activity/activity-cache";
import {t as translateUi} from "@/lib/i18n";
import {I18nProvider} from "@/components/i18n-provider";
import {ChatSessionProvider} from "@/features/ai/chat-session";
import {ProfileCompletionNotice} from "@/features/profile/completion-notice";
import {getVerifiedProxyIdentity} from "@/features/auth/session";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { getPreferences } from "@/lib/preferences";
import { DeferredChatWidget } from "@/features/ai/deferred-chat-widget";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

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
  const title = translateUi((en) ? "en" : "ar", "لُبّ | منصة الأندية الطلابية", "LUB | Student Clubs and Events");
  const description = translateUi((en) ? "en" : "ar", "اكتشف الأندية والمجالس الطلابية والفعاليات المنشورة في كلية علوم الحاسب والمعلومات بجامعة الإمام محمد بن سعود الإسلامية عبر منصة لُبّ.", "Discover student clubs, councils, and events at the College of Computer and Information Sciences, Imam Mohammad Ibn Saud Islamic University, through LUB.");
  return {
    metadataBase: new URL("https://lub.community"),
    alternates: { canonical: "/" },
    title: { default: title, template: translateUi((en) ? "en" : "ar", "%s | لُبّ", "%s | LUB") },
    description,
    robots: { index: true, follow: true },
    icons: { icon: [{ url: "/favicon.ico", sizes: "any", type: "image/x-icon" }] },
    openGraph: {
      type: "website",
      siteName: translateUi((en) ? "en" : "ar", "لُبّ", "LUB"),
      locale: en ? "en_US" : "ar_SA",
      title,
      description,
      images: [{ url: "/brand/share-card.png", width: 1200, height: 630, alt: translateUi((en) ? "en" : "ar", "شعار لُبّ", "LUB logo") }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/brand/share-card.png"] },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [{ locale, theme },identity] = await Promise.all([getPreferences(),getVerifiedProxyIdentity()]);
  return <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} data-theme={theme} className={thmanyahDisplay.variable}><body className="min-h-screen antialiased">
    <a href="#main" className="fixed start-4 top-4 z-50 -translate-y-32 rounded-lg bg-white p-4 text-ink focus:translate-y-0">{translateUi((locale === "ar") ? "ar" : "en", "تخطي إلى المحتوى", "Skip to content")}</a>
    <DirectionProvider direction={locale === "ar" ? "rtl" : "ltr"}><I18nProvider locale={locale}><ActivityCacheProvider actorId={identity?.id??null}><ChatSessionProvider locale={locale}><Toaster timeout={3000}>{children}{identity&&<ProfileCompletionNotice locale={locale}/>}</Toaster>
    <DeferredChatWidget locale={locale} /></ChatSessionProvider></ActivityCacheProvider></I18nProvider></DirectionProvider>
  </body></html>;
}
