import { Suspense } from "react";
import { PublicHeader } from "@/components/public-header";

function PublicHeaderLoading() {
  return <header className="site-header" aria-hidden="true">
    <div dir="ltr" className="site-header-inner mx-auto max-w-7xl px-5 sm:px-8">
      <div className="site-header-brand h-9 w-28 animate-pulse rounded-lg bg-mist" />
      <nav className="site-header-nav">
        {["one", "two", "three", "four"].map(item => <span key={item} className="h-4 w-16 animate-pulse rounded bg-mist" />)}
      </nav>
      <div className="site-header-tools flex items-center gap-3 py-2">
        <span className="h-9 w-10 animate-pulse rounded-lg bg-mist" />
        <span className="h-9 w-20 animate-pulse rounded-lg bg-mist" />
        <span className="h-9 w-24 animate-pulse rounded-lg bg-mist" />
      </div>
    </div>
  </header>;
}

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>
    <Suspense fallback={<PublicHeaderLoading />}><PublicHeader /></Suspense>
    {children}
  </>;
}
