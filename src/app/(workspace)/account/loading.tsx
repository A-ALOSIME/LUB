import {FormPlaceholder,LoadingRegion} from "@/components/workspace-loading";

export default function Loading(){return <LoadingRegion title={["بيانات الحساب","Account details"]} className="workspace-content account-settings-page"><FormPlaceholder fields={8} columns avatar/></LoadingRegion>;}
