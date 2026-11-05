"use client";
import {useRouter} from "next/navigation";
import {useState,type ComponentProps} from "react";
import {useManagementAction,ManagementActionSheet} from "@/components/management-action-sheet";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import {TaskForm} from "./task-form";
import {SubmissionForm} from "./submission-form";
export function TaskPageForm(props:ComponentProps<typeof TaskForm>){const router=useRouter(),management=useManagementAction();return <TaskForm {...props} onSuccess={()=>{props.onSuccess?.();if(!management?.inlineForms)router.refresh();}}/>;}
export function TaskPageSubmission(props:ComponentProps<typeof SubmissionForm>){const router=useRouter();return <SubmissionForm {...props} onSuccess={()=>router.refresh()}/>;}

export function TaskSubmissionAction({participant,revision,lastRevision,locale}:{participant:string;revision:number;lastRevision:number;locale:Locale}){
 const [open,setOpen]=useState(false),router=useRouter(),management=useManagementAction(),t=createTranslator(locale);
 return <ManagementActionSheet label={t("سلّم الآن","Submit now")} title={t("إضافة تسليم","Add submission")} locale={locale} variant="default" open={open} onOpenChange={setOpen}><SubmissionForm participant={participant} revision={revision} lastRevision={lastRevision} locale={locale} onSuccess={()=>{setOpen(false);if(!management?.inlineForms)router.refresh();}}/></ManagementActionSheet>;
}
