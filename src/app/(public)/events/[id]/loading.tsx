import {LoadingRegion} from "@/components/workspace-loading";
import {Card} from "@/components/ui/card";
import {Skeleton} from "@/components/ui/skeleton";

export default function Loading(){return <main id="main" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
  <LoadingRegion>
    <Skeleton className="h-9 w-28"/>
    <Card className="grid gap-5 p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:p-6">
      <Skeleton className="aspect-[4/5] w-full"/>
      <div className="min-w-0 space-y-5">
        <Skeleton className="h-6 w-40 max-w-full"/><Skeleton className="h-10 w-64 max-w-full"/>
        <Card className="divide-y divide-border/50 gap-0 px-4 py-0">
          {[0,1,2].map(row=><div key={row} className="flex items-start gap-3 py-3">
            <Skeleton className="size-9 shrink-0"/><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-40 max-w-full"/><Skeleton className="h-3 w-28 max-w-full"/></div>
          </div>)}
        </Card>
        <Skeleton className="h-10 w-36 max-w-full"/>
      </div>
    </Card>
  </LoadingRegion>
</main>;}
