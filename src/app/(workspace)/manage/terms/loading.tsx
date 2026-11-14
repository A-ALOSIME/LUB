import {FormPlaceholder,LoadingRegion} from "@/components/workspace-loading";
import {Skeleton} from "@/components/ui/skeleton";

export default function Loading(){return <LoadingRegion title={["الفصول الأكاديمية","Academic terms"]}><Skeleton className="h-4 w-3/4"/><FormPlaceholder fields={3}/><Skeleton className="h-28 w-full"/></LoadingRegion>;}
