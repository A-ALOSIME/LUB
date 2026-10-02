import {LocalizedText} from "@/components/localized-text";
export default function Loading() {
  return <div className="mx-auto max-w-6xl px-5 py-14" role="status"><h1 className="text-3xl font-bold"><LocalizedText ar="الأندية والمجالس" en="Clubs and councils"/></h1><p className="mt-5 text-muted"><LocalizedText ar="جارٍ تحميل الجهات…" en="Loading organizations…"/></p></div>;
}
