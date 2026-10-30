"use client";
import {useI18n} from "./i18n-provider";
import {translateContent} from "@/lib/content-translation";
import {localizeDigits} from "@/lib/i18n";
/** Display only. Editors keep the original value, and URLs/identities are never transformed. */
export function ContentText({value}:{value:string|null|undefined}){
 const {locale}=useI18n();return value?localizeDigits(translateContent(value,locale)):null;
}
