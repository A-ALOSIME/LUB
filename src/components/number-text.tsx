"use client";
import {formatNumber} from "@/lib/i18n";
import {useI18n} from "./i18n-provider";
export function NumberText({value}:{value:number|string}){const {locale}=useI18n();return <>{formatNumber(value,locale)}</>;}
