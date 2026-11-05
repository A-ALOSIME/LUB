"use client";

import {useRouter} from "next/navigation";
import {useListQuery} from "@/lib/list-query";

import {ContentText} from "@/components/content-text";
import {createTranslator} from "@/lib/i18n";
import {NumberText} from "@/components/number-text";
import { useState } from "react";
import {OrganizationLogo} from "@/components/organization-logo";
import { UserRound, UserRoundMinus, Power, Building2, Archive,ArrowLeftRight } from "lucide-react";
import { RowAction } from "@/components/row-action";
import {ItemTable,ItemTitle} from "@/components/item-table";


import {ListEmpty} from "@/components/list-empty";
import { OrganizationStatusBadge } from "./organization-status-badge";
import { AdminOrganizationDecision } from "./admin-organization-decision";
import type { AdminOrganizationRow } from "./management-repository";
import type { Locale } from "@/lib/preferences";
export function AdminOrganizationTable({
  organizations,
  locale,onChanged,
}: {
  organizations: AdminOrganizationRow[];
  locale: Locale;onChanged?:()=>void;
}) {
  const router=useRouter(),{params}=useListQuery();
  const en = locale === "en",
    c = createTranslator((en) ? "en" : "ar"),
    [decision, setDecision] = useState<{
      organization: AdminOrganizationRow;
      kind: "leader" | "status" | "remove-leader" | "archive";
    } | null>(null);
  function status(item: AdminOrganizationRow) {
    return (
      <OrganizationStatusBadge
        status={
          item.statusCode === "Active"
            ? "active"
            : item.statusCode === "Archived"
              ? "archived"
              : "inactive"
        }
      >
        {item.statusCode === "Active"
          ? c("نشطة", "Active")
          : item.statusCode === "Archived"
            ? c("مؤرشفة", "Archived")
            : c("موقوفة", "Inactive")}
      </OrganizationStatusBadge>
    );
  }
  function leader(item: AdminOrganizationRow) {
    return item.leaderName ?? c("لا يوجد","None");
  }
  function actions(item: AdminOrganizationRow) {
    return <div className="inline-flex items-center gap-1">
      <RowAction label={c("إزالة القائد","Remove leader")} danger disabled={!item.leaderName} onClick={()=>setDecision({organization:item,kind:"remove-leader"})}><UserRoundMinus/></RowAction>
      <RowAction label={c("أرشفة الجهة","Archive organization")} disabled={item.statusCode==="Archived"} onClick={()=>setDecision({organization:item,kind:"archive"})}><Archive/></RowAction>
      <RowAction label={item.statusCode==="Active"?c("إيقاف الجهة","Deactivate organization"):c("تفعيل الجهة","Activate organization")} onClick={()=>setDecision({organization:item,kind:"status"})}><Power/></RowAction>
      <RowAction label={item.leaderName?c("تغيير القائد","Change leader"):c("تعيين قائد","Assign leader")} onClick={()=>setDecision({organization:item,kind:"leader"})}><span className="relative"><UserRound/>{item.leaderName&&<ArrowLeftRight className="absolute -end-1 -bottom-1 size-2"/>}</span></RowAction>
    </div>;
  }
  function name(item: AdminOrganizationRow) {
    return (
      <span className="flex min-w-0 items-center gap-3">
        <OrganizationLogo name={item.nameAr} src={item.logoUrl} size="lg"/>
        <ItemTitle><ContentText value={item.nameAr}/></ItemTitle>
      </span>
    );
  }
  return <>
    <ItemTable compact items={organizations} label={c("عرض تفاصيل الجهة","View organization details")} empty={<ListEmpty filtered={Boolean(params.get("status"))} clear={()=>router.push("/manage/organizations")} icon={Building2} title={c("لا توجد جهات مطابقة.","No matching organizations.")} description={c("ستظهر الجهات المضافة هنا.","Organizations will appear here.")}/>} columns={[
      {id:"name",label:c("الجهة","Organization"),render:name},
      {id:"type",label:c("النوع","Type"),className:"w-24",render:item=>item.typeCode==="Club"?c("نادي","Club"):c("مجلس","Council")},
      {id:"status",label:c("الحالة","Status"),className:"w-28",render:status},
      {id:"leader",label:c("القائد","Leader"),className:"w-40",render:leader},
      {id:"count",label:c("عدد الأعضاء","Members"),className:"w-24",render:item=><NumberText value={item.memberCount}/>},
      {id:"actions",label:c("الإجراءات","Actions"),className:"w-48",render:actions}
    ]}/>
      {decision && (
        <AdminOrganizationDecision
          organization={decision.organization}
          kind={decision.kind}
          locale={locale}
          onClose={() => setDecision(null)}
          onChanged={onChanged}
        />
      )}
    </>;
}
