import {FormPlaceholder,LoadingRegion} from "@/components/workspace-loading";
import {Skeleton} from "@/components/ui/skeleton";

export default function Loading(){return <LoadingRegion title={["ملفي المهاري","My talent profile"]}>
  <Skeleton className="h-11 w-80 max-w-full"/>
  <FormPlaceholder fields={4}/>
  <Skeleton className="h-24 w-full"/>
</LoadingRegion>;}
