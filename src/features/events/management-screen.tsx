"use client";
import {useEffect,useSyncExternalStore} from "react";
import {PagedOrganizationEventsView} from "./paged-management-screen";
import {useI18n} from "@/components/i18n-provider";
import {Skeleton} from "@/components/ui/skeleton";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {useOrganizationEventsCache} from "./management-cache";
import {OrganizationEventsView} from "./management-view";

function subscribe(notify:()=>void){window.addEventListener("popstate",notify);window.addEventListener("organization-section-change",notify);return()=>{window.removeEventListener("popstate",notify);window.removeEventListener("organization-section-change",notify);};}
export function OrganizationEventsScreen({organization}:{organization:string}){
 const {locale,t}=useI18n(),{entries,ensure,refresh,check,cancel}=useOrganizationEventsCache(),entry=entries[organization];
 const query=useSyncExternalStore(subscribe,()=>window.location.search,()=>"");
 useEffect(()=>{void ensure(organization);return()=>cancel(organization);},[organization,ensure,cancel]);
 useEffect(()=>{if(!entry?.data)return;const inspect=()=>{if(document.visibilityState!=="hidden"&&navigator.onLine!==false)void check(organization);};const timer=setInterval(inspect,30000);window.addEventListener("focus",inspect);document.addEventListener("visibilitychange",inspect);return()=>{clearInterval(timer);window.removeEventListener("focus",inspect);document.removeEventListener("visibilitychange",inspect);};},[organization,entry?.data,check]);
 if(!entry?.data)return entry?.error?<Alert variant="destructive"><AlertDescription>{t("تعذّر تحميل فعاليات الجهة وإعلاناتها. حاول مجددًا.","Could not load organization events and announcements. Please try again.")}</AlertDescription><Button variant="outline" onClick={()=>void refresh(organization)}>{t("إعادة المحاولة","Retry")}</Button></Alert>:<div role="status" aria-label={t("جارٍ تحميل فعاليات الجهة","Loading organization events")} className="flex flex-col gap-4"><Skeleton className="h-10 w-72"/><Skeleton className="h-40 w-full"/></div>;
 const search=Object.fromEntries(new URLSearchParams(query));
 function onChange(values:Record<string,string|null>,replace=false){const url=new URL(window.location.href);for(const [key,value]of Object.entries(values))if(!value||value==="all"||value==="0")url.searchParams.delete(key);else url.searchParams.set(key,value);window.history[replace?"replaceState":"pushState"](window.history.state,"",url);window.dispatchEvent(new Event("organization-section-change"));}
 if(entry.data.paged)return <PagedOrganizationEventsView id={organization} snapshot={entry.data} search={search} locale={locale} onChange={onChange}/>;
 return <OrganizationEventsView id={organization} snapshot={entry.data} search={search} locale={locale} onChange={onChange}/>;
}
