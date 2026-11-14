import {FormPlaceholder,LoadingRegion} from "@/components/workspace-loading";

export default function Loading(){return <LoadingRegion title={["إعدادات الحساب","Account settings"]} className="max-w-2xl"><FormPlaceholder fields={2}/></LoadingRegion>;}
