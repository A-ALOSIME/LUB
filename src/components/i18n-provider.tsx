"use client";
import {createContext,useContext,useMemo,type ReactNode} from "react";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
const LocaleContext=createContext<Locale>("ar");
export function I18nProvider({locale,children}:{locale:Locale;children:ReactNode}){return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;}
export function useI18n(){const locale=useContext(LocaleContext);return useMemo(()=>({locale,dir:locale==="ar"?"rtl" as const:"ltr" as const,t:createTranslator(locale)}),[locale]);}
