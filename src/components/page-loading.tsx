import {LocalizedText} from "@/components/localized-text";

export function PageLoading({titleAr, titleEn, loadingAr, loadingEn}: {
  titleAr: string;
  titleEn: string;
  loadingAr: string;
  loadingEn: string;
}) {
  return <main id="main" className="mx-auto max-w-6xl px-5 py-8 sm:px-8" aria-busy="true">
    <h1 className="sr-only"><LocalizedText ar={titleAr} en={titleEn}/></h1>
    <div className="space-y-5" role="status">
      <span className="sr-only"><LocalizedText ar={loadingAr} en={loadingEn}/></span>
      <div aria-hidden="true" className="animate-pulse">
        <div className="h-8 w-56 max-w-full rounded bg-mist" />
        <div className="mt-4 h-4 w-[min(32rem,100%)] rounded bg-mist" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {["one", "two", "three", "four", "five", "six"].map(item => <div key={item} className="panel overflow-hidden p-4">
            <div className="aspect-[16/9] rounded-lg bg-mist" />
            <div className="mt-4 h-5 w-2/3 rounded bg-mist" />
            <div className="mt-3 h-4 w-full rounded bg-mist" />
          </div>)}
        </div>
      </div>
    </div>
  </main>;
}
