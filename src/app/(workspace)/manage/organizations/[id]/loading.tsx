import { LocalizedText } from "@/components/localized-text";

const rows = ["one", "two", "three"];

export default function Loading() {
  return <div role="status" aria-busy="true" className="workspace-content organization-management-page space-y-6">
    <span className="sr-only"><LocalizedText ar="جارٍ تحميل إدارة الجهة…" en="Loading organization workspace…" /></span>
    <section aria-hidden="true" className="panel space-y-5 p-4 sm:p-5">
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <div className="size-12 animate-pulse rounded-xl bg-mist" />
        <div className="space-y-2"><div className="h-4 w-36 animate-pulse rounded bg-mist" /><div className="h-5 w-52 max-w-full animate-pulse rounded bg-mist" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map(row => <div key={row} className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-mist" />
          <div className="h-10 animate-pulse rounded-lg bg-mist" />
        </div>)}
      </div>
    </section>
    <section aria-hidden="true" className="panel space-y-4 p-4 sm:p-5">
      <div className="h-6 w-40 animate-pulse rounded bg-mist" />
      {rows.map(row => <div key={row} className="flex items-center justify-between gap-4 border-t border-line py-3">
        <div className="h-5 w-48 max-w-full animate-pulse rounded bg-mist" />
        <div className="h-8 w-20 animate-pulse rounded-lg bg-mist" />
      </div>)}
    </section>
  </div>;
}
