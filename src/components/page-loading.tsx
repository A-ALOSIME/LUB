import Image from "next/image";
import {LocalizedText} from "@/components/localized-text";

export function PageLoading({titleAr, titleEn, loadingAr, loadingEn}: {
  titleAr: string;
  titleEn: string;
  loadingAr: string;
  loadingEn: string;
}) {
  return <main id="main" className="mx-auto max-w-6xl px-5 py-8 sm:px-8" aria-busy="true">
    <h1 className="sr-only"><LocalizedText ar={titleAr} en={titleEn}/></h1>
    <div className="page-loading" role="status">
      <span className="sr-only"><LocalizedText ar={loadingAr} en={loadingEn}/></span>
      <span className="page-loading-mark" aria-hidden="true">
        <Image src="/brand/symbol-reversed.svg" alt="" width={100} height={100} unoptimized />
      </span>
    </div>
  </main>;
}
