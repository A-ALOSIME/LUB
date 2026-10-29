"use client";
import {createTranslator} from "@/lib/i18n";
import {useState} from "react";
import {Pencil} from "lucide-react";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {FormField} from "@/components/form-field";
import {NativeSelect} from "@/components/ui/native-select";
import {TaskForm} from "./task-form";
import {TaskFields} from "./task-fields";
import type {Task,TaskTemplate,TaskWorkspace} from "./repository";
import type {Locale} from "@/lib/preferences";
export function TaskComposer({org,workspace,source,task,locale="ar",rowAction=false,initiallyOpen=false}:{org:string;workspace:TaskWorkspace;source?:TaskTemplate;task?:Task;locale?:Locale;rowAction?:boolean;initiallyOpen?:boolean}){
 const en=locale==="en",c=createTranslator(en ? "en" : "ar");
 return <ManagementActionSheet label={task?c("تعديل المهمة","Edit task"):c("مهمة جديدة","New task")} title={task?c("تعديل المهمة","Edit task"):c("إنشاء مهمة","Create task")} locale={locale} width="wide" variant={task?"outline":"default"} triggerSize="default" rowAction={rowAction} icon={task?<Pencil/>:undefined} initiallyOpen={initiallyOpen}>
 <TaskEditorForm org={org} workspace={workspace} source={source} task={task} locale={locale}/></ManagementActionSheet>;
}
export function TaskEditorForm({org,workspace,source,task,locale="ar"}:{org:string;workspace:TaskWorkspace;source?:TaskTemplate;task?:Task;locale?:Locale}){
 const scopes=workspace.scopes.filter(s=>s.tasks),[committee,setCommittee]=useState(task?.committee_id??source?.committee_id??scopes[0]?.id??""),[template,setTemplate]=useState(source?.id??"");
 const selected=workspace.templates.find(t=>t.id===template);const en=locale==="en",c=createTranslator(en ? "en" : "ar");
 const value=task??(selected?{title:selected.name,description:selected.description_template,default_hours:selected.default_hours}:undefined);
 return ( <TaskForm key={task?.id??template} operation="save-task" fields={{org,...(task?{task:task.id,revision:String(task.revision),committee:task.committee_id??""}:{}),...(template?{template}: {})}} label={c("حفظ التعديل","Save changes")} locale={locale} creationActions={!task} canSaveTemplate={workspace.scopes.some(s=>s.templates&&(s.id??"")===committee)} confirmDescription={task?c("ستُحفظ نسخة جديدة مع إبقاء التسليمات السابقة مرتبطة بنسخها.","Save a new revision while preserving earlier submissions."):undefined}>
 <TaskFields value={value} locale={locale} organization={org} committee={committee||null} rules={task?[]:workspace.hourRules.filter(r=>(r.committee_id===null||r.committee_id===committee)&&(!r.task_template_id||r.task_template_id===template))}
 scopeField={!task?<FormField label={c("نطاق العمل","Work scope")}><NativeSelect name="committee" value={committee} onChange={event=>{setCommittee(event.target.value);setTemplate("");}}>{scopes.map(s=><option key={s.id??"org"} value={s.id??""}>{s.name}</option>)}</NativeSelect></FormField>:null}
 templatePicker={!task?<FormField label={c("ابدأ من قالب (اختياري)","Start from a template (optional)")}><NativeSelect value={template} onChange={event=>setTemplate(event.target.value)}><option value="">{c("بدون قالب","No template")}</option>{workspace.templates.filter(t=>t.is_active&&(t.committee_id===null||t.committee_id===committee)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect></FormField>:null}/>
 </TaskForm>);
}
