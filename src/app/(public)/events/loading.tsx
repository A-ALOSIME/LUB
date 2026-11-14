import {LoadingRegion} from "@/components/workspace-loading";
import {Card} from "@/components/ui/card";
import {Skeleton} from "@/components/ui/skeleton";

export default function Loading(){return <main id="main" className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
  <LoadingRegion title={["الفعاليات","Events"]}>
    <Skeleton className="h-4 w-80 max-w-full"/>
    <ul className="event-discovery-grid">{[0,1,2,3].map(item=><li key={item}><Card className="gap-0 overflow-hidden py-0">
      <Skeleton className="aspect-[4/5] w-full rounded-none"/>
      <div className="space-y-4 p-4"><Skeleton className="h-6 w-3/4"/><Skeleton className="h-4 w-1/2"/><Skeleton className="h-4 w-2/3"/><Skeleton className="h-9 w-full"/></div>
    </Card></li>)}</ul>
  </LoadingRegion>
</main>;}
