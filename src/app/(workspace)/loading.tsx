import { LocalizedText } from "@/components/localized-text";

export default function Loading() {
  return <div role="status" aria-busy="true" className="space-y-4">
    <span className="sr-only"><LocalizedText ar="جارٍ تحميل الصفحة…" en="Loading page…" /></span>
    <div aria-hidden="true" className="panel animate-pulse space-y-4 p-5 sm:p-6">
      <div className="h-7 w-44 rounded bg-mist" />
      <div className="h-4 w-72 max-w-full rounded bg-mist" />
      <div className="mt-6 space-y-3">
        {["one", "two", "three"].map(item => <div key={item} className="h-14 rounded-lg bg-mist" />)}
      </div>
    </div>
  </div>;
}
