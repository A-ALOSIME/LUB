import { LocalizedText } from "@/components/localized-text";

const placeholders = ["overview-one", "overview-two", "overview-three", "section-one", "section-two", "section-three", "section-four"];

export default function Loading() {
  return <div role="status" aria-busy="true" className="space-y-6">
    <span className="sr-only"><LocalizedText ar="جارٍ تحميل إدارتك…" en="Loading your workspace…" /></span>
    <header aria-hidden="true" className="border-b border-line pb-5">
      <div className="space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-mist" />
        <div className="h-9 w-64 max-w-full animate-pulse rounded bg-mist" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-mist" />
      </div>
    </header>
    <div aria-hidden="true" className="grid gap-3 sm:grid-cols-3">
      {placeholders.slice(0, 3).map(item => <div key={item} className="panel flex h-20 items-center justify-between p-5">
        <div className="h-4 w-28 animate-pulse rounded bg-mist" />
        <div className="h-8 w-10 animate-pulse rounded bg-mist" />
      </div>)}
    </div>
    <div aria-hidden="true" className="panel grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_12rem_6rem] sm:items-end sm:p-5">
      <div className="space-y-2"><div className="h-4 w-24 animate-pulse rounded bg-mist" /><div className="h-12 animate-pulse rounded-lg bg-mist" /></div>
      <div className="space-y-2"><div className="h-4 w-24 animate-pulse rounded bg-mist" /><div className="h-12 animate-pulse rounded-lg bg-mist" /></div>
      <div className="h-12 animate-pulse rounded-lg bg-mist" />
    </div>
    <section aria-hidden="true" className="space-y-3">
      {placeholders.slice(3, 6).map(item => <div key={item} className="panel flex min-h-20 items-center gap-3 p-4 sm:p-5">
        <div className="size-11 animate-pulse rounded-xl bg-mist" />
        <div className="min-w-0 flex-1 space-y-2"><div className="h-5 w-40 max-w-full animate-pulse rounded bg-mist" /><div className="h-4 w-56 max-w-full animate-pulse rounded bg-mist" /></div>
        <div className="h-10 w-24 animate-pulse rounded-lg bg-mist" />
      </div>)}
    </section>
  </div>;
}
