import { PublicHeader } from "@/components/public-header";
import { LubWordmark } from "@/components/lub-wordmark";
import { ChatWidget } from "@/features/ai/chat-widget";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata() {
  return localizedMetadata("اسأل لُبّ", "Ask LUB");
}

export default async function KnowledgePage() {
  const { locale } = await getPreferences();
  const en = locale === "en";

  return <>
    <PublicHeader />
    <main id="main" className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-5xl flex-col justify-center px-5 py-16 sm:px-8">
      <h1 aria-label={en ? undefined : "اسأل لُبّ"} className="lub-ai-title w-full text-center text-5xl leading-tight sm:text-6xl">{en ? "Ask LUB" : <><span aria-hidden="true">اسأل</span><LubWordmark /></>}</h1>
      <ChatWidget locale={locale} inline />
    </main>
  </>;
}
