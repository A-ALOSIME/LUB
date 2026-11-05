"use client";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {ContactRound} from "lucide-react";
import {RowAction} from "@/components/row-action";
import {MemberDetailSheet} from "@/features/organizations/member-detail-sheet";
import type {MemberRecord} from "@/features/organizations/member-types";
import {useQueryActor} from "@/components/private-query-provider";
import {privateJson} from "@/lib/private-query";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
export function ApplicantProfileAction({organization,application,locale}:{organization:string;application:string;locale:Locale}){
 const [open,setOpen]=useState(false),actor=useQueryActor(),t=createTranslator(locale);
 const result=useQuery({queryKey:["applicant-profile",actor,organization,application],queryFn:({signal})=>privateJson<MemberRecord>(`/api/organizations/${organization}/applications/${application}/profile`,signal),enabled:open});
 return <><RowAction label={t("المعلومات الأساسية للطالب","Student basic information")} onClick={()=>setOpen(true)}><ContactRound/></RowAction><MemberDetailSheet open={open} onOpenChange={setOpen} record={result.data??null} error={result.isError} locale={locale} basicOnly/></>;
}
