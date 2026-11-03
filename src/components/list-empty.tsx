"use client";
import type {LucideIcon} from "lucide-react";
import {WorkspaceEmptyState} from "@/components/workspace-empty-state";
import {Button} from "@/components/ui/button";
import {useI18n} from "@/components/i18n-provider";
export function ListEmpty({filtered,clear,icon,title,description}:{filtered:boolean;clear:()=>void;icon:LucideIcon;title:string;description:string}){
 const {t}=useI18n();
 return <WorkspaceEmptyState icon={icon} title={filtered?t("لا توجد نتائج مطابقة","No matching results"):title} description={filtered?t("جرّب تغيير البحث أو الفلاتر.","Try another search or filter."):description} action={filtered?<Button variant="outline" onClick={clear}>{t("مسح الفلاتر","Clear filters")}</Button>:undefined}/>;
}
