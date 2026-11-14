import {FormPlaceholder,LoadingRegion} from "@/components/workspace-loading";
import {Skeleton} from "@/components/ui/skeleton";

export default function Loading(){return <LoadingRegion><Skeleton className="h-9 w-48"/><Skeleton className="h-11 w-80 max-w-full"/><FormPlaceholder fields={5} columns avatar/></LoadingRegion>;}
