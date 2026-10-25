"use client";
import {useState, type ReactNode} from "react";
import {Field, FieldDescription, FieldError, FieldLabel} from "@/components/ui/field";
import type {Locale} from "@/lib/preferences";

export function ValidatedField({id,label,required=false,hint,children,locale="ar"}:{id:string;label:string;required?:boolean;hint?:string;children:ReactNode;locale?:Locale}) {
  const [error,setError]=useState("");
  return <Field data-invalid={!!error || undefined} onInvalidCapture={event=>{event.preventDefault();const field=event.target as HTMLInputElement;setError(locale==="en"?field.validationMessage:field.validity.valueMissing?"هذا الحقل مطلوب.":"راجع القيمة المدخلة.");if(field.form?.querySelector(":invalid")===field)field.focus();}} onInputCapture={()=>setError("")}>
    <FieldLabel htmlFor={id}>{label}{required&&<span className="text-destructive" aria-hidden="true">*</span>}</FieldLabel>
    {children}{hint&&<FieldDescription>{hint}</FieldDescription>}{error&&<FieldError role="alert">{error}</FieldError>}
  </Field>;
}
