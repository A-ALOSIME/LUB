import {LocalizedText} from "@/components/localized-text";
import {Skeleton} from "@/components/ui/skeleton";

export function PageLoading({titleAr, titleEn, loadingAr, loadingEn}: {
  titleAr: string;
  titleEn: string;
  loadingAr: string;
  loadingEn: string;
}) {
  return <main id="main" className="mx-auto max-w-6xl space-y-5 px-5 py-8 sm:px-8" aria-busy="true">
    <h1 className="sr-only"><LocalizedText ar={titleAr} en={titleEn}/></h1>
    <div className="space-y-4" role="status">
      <span className="sr-only"><LocalizedText ar={loadingAr} en={loadingEn}/></span>
      <Skeleton aria-hidden="true" className="h-9 w-56 max-w-full"/>
      <Skeleton aria-hidden="true" className="h-4 w-80 max-w-full"/>
    </div>
  </main>;
}
