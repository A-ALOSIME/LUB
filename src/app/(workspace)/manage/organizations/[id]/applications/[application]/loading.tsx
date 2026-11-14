import {FormPlaceholder,LoadingRegion} from "@/components/workspace-loading";
import {Skeleton} from "@/components/ui/skeleton";

export default function Loading(){return <LoadingRegion><Skeleton className="h-36 w-full"/><FormPlaceholder fields={2}/></LoadingRegion>;}
