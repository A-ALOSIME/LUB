"use client";
import {useActionState,useEffect,useRef,useState,type ReactNode} from "react";
import {mutateDocument,type DocumentState} from "./actions";
import type {Term} from "@/features/hours/repository";
import type {Locale} from "@/lib/preferences";
import {actionFeedback} from "@/lib/action-feedback";
export function DocumentForm({operation,fields={},label,children,locale="ar"}:{operation:string;fields?:Record<string,string>;label:string;children?:ReactNode;locale?:Locale}){
 const [state,action,pending]=useActionState<DocumentState,FormData>(mutateDocument,{}),alert=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(state.error)alert.current?.focus();},[state]);
 const en=locale==="en";
 return <form action={action} onReset={e=>e.preventDefault()} className="space-y-4"><input type="hidden" name="operation" value={operation}/>{Object.entries(fields).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}<fieldset disabled={pending} className="min-w-0 space-y-4">{children}<button className="button">{pending?en?'Saving…':'جارٍ الحفظ…':label}</button></fieldset>{state.error&&<p ref={alert} role="alert" tabIndex={-1} className="error-message">{actionFeedback(state.error,locale)}{state.document&&<> <a className="text-link" href="/documents">{en?"Document history":"سجل المستندات"}</a></>}</p>}{state.success&&<p role="status" className="text-action">{actionFeedback(state.success,locale)}{state.document&&<> <a className="text-link" href={`/documents/${state.document}/file`}>{en?"Download saved copy":"تنزيل النسخة المحفوظة"}</a> · <a className="text-link" href="/documents">{en?"Document history":"سجل المستندات"}</a></>}</p>}</form>;
}
export function PeriodFields({terms,locale="ar"}:{terms:Term[];locale?:Locale}){
 const [period,setPeriod]=useState('All'),en=locale==="en";return <><label>{en?"Period":"الفترة"}<select name="period" value={period} onChange={e=>setPeriod(e.target.value)}><option value="All">{en?"All time":"كل التاريخ"}</option><option value="Term">{en?"Academic term":"فصل أكاديمي"}</option><option value="Year">{en?"Academic year":"سنة أكاديمية"}</option><option value="Custom">{en?"Custom period":"فترة مخصصة"}</option></select></label>
 {period==='Term'&&<label>{en?"Term":"الفصل"}<select name="term" required><option value="">{en?"Choose term":"اختر الفصل"}</option>{terms.map(t=><option key={t.id} value={t.id} dir="auto">{t.name_ar} · {t.academic_year}</option>)}</select></label>}{period==='Year'&&<label>{en?"Academic year":"السنة الأكاديمية"}<select name="year" required><option value="">{en?"Choose year":"اختر السنة"}</option>{[...new Set(terms.map(t=>t.academic_year))].map(year=><option key={year}>{year}</option>)}</select></label>}{period==='Custom'&&<div className="grid gap-4 sm:grid-cols-2"><label>{en?"From date":"من تاريخ"}<input name="starts" type="date" required/></label><label>{en?"To date":"إلى تاريخ"}<input name="ends" type="date" required/></label></div>}</>;
}
