"use client";
import {useI18n} from "./i18n-provider";
import {translateContent} from "@/lib/content-translation";
import {localizeDigits} from "@/lib/i18n";
import {useRemoteContentTranslation} from "@/lib/remote-content-translation";
import {englishOrganizationName} from "@/lib/organization-names";
/** Display only. Editors keep the original value, and URLs/identities are never transformed. */
export function ContentText({value,autoTranslate=false}:{value:string|null|undefined;autoTranslate?:boolean}){
 const {locale}=useI18n();
 const englishName=value?englishOrganizationName(value):undefined;
 const translated=useRemoteContentTranslation(value??"",autoTranslate&&locale==="en"&&!englishName);
 return value?localizeDigits(autoTranslate?(locale==="en"?englishName??translated:value):translateContent(value,locale)):null;
}
