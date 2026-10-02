import { PublicHeader } from "@/components/public-header";
import { KnowledgeSearch } from "@/features/ai/form";
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
    <main id="main" className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl flex-col justify-center px-5 py-16 sm:px-8">
      <h1 className="font-display text-center text-4xl leading-normal sm:text-5xl">{en ? "Ask LUB" : "اسأل لُبّ"}</h1>
      <KnowledgeSearch locale={locale} />
    </main>
  </>;
}
