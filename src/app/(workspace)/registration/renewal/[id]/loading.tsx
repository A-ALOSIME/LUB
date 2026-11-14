import {LoadingRegion,TablePlaceholder} from "@/components/workspace-loading";
import {Skeleton} from "@/components/ui/skeleton";

export default function Loading(){return <LoadingRegion><Skeleton className="h-9 w-28"/><Skeleton className="h-9 w-64 max-w-full"/><TablePlaceholder columns={5}/></LoadingRegion>;}
