import {notFound} from "next/navigation";
import {PublicHeader} from "@/components/public-header";
import {EventExampleDetail, getEventExample, eventExamples} from "@/features/events/examples";
import {getPreferences} from "@/lib/preferences";
import {localizedMetadata} from "@/lib/localized-metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return eventExamples.map(({id}) => ({slug: id}));
}

export async function generateMetadata({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  const example = getEventExample(slug);
  if (!example) return localizedMetadata("نموذج فعالية", "Event example");
  return localizedMetadata(example.title.ar, example.title.en);
}

export default async function EventExamplePage({params}: {params: Promise<{slug: string}>}) {
  const [{slug}, {locale}] = await Promise.all([params, getPreferences()]);
  const example = getEventExample(slug);
  if (!example) notFound();

  return <>
    <PublicHeader/>
    <main id="main" className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <EventExampleDetail example={example} locale={locale}/>
    </main>
  </>;
}
