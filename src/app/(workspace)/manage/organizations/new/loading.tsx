import {FormPlaceholder,LoadingRegion} from "@/components/workspace-loading";
import {Skeleton} from "@/components/ui/skeleton";

export default function Loading(){return <LoadingRegion title={["إضافة جهة","Add organization"]} className="mx-auto w-full max-w-3xl"><Skeleton className="h-9 w-28"/><FormPlaceholder/></LoadingRegion>;}
