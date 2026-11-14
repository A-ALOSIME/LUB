import {LoadingRegion} from "@/components/workspace-loading";
import {Card} from "@/components/ui/card";
import {Skeleton} from "@/components/ui/skeleton";

export default function Loading(){return <main id="main" className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
  <LoadingRegion>
    <div className="directory-heading"><div className="space-y-3"><Skeleton className="h-4 w-48 max-w-full"/><Skeleton className="h-10 w-56 max-w-full"/></div><Skeleton className="h-9 w-36"/></div>
    {[2,3].map(count=><div key={count} className="space-y-4">
      <Skeleton className="mx-auto h-5 w-24"/>
      <div className={count===2?"directory-grid directory-grid--councils":"directory-grid"}>
        {Array.from({length:count},(_,item)=><Card key={item} className="gap-0 overflow-hidden py-0">
          <Skeleton className="organization-card-art rounded-none"/><div className="space-y-3 p-4"><Skeleton className="h-5 w-4/5"/><Skeleton className="h-5 w-1/2"/></div>
        </Card>)}
      </div>
    </div>)}
  </LoadingRegion>
</main>;}
