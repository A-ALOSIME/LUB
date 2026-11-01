import Link from "next/link";
import {Brand} from "@/components/brand";
import {Separator} from "@/components/ui/separator";
import {FooterContactIcons} from "./footer-contact-icons";
import {getSiteSettings} from "@/lib/site-settings";
import {getPreferences} from "@/lib/preferences";
import {createTranslator} from "@/lib/i18n";
import {requestTime} from "@/lib/request-time";
import {LubBrandName} from "@/components/lub-brand-name";
export async function PublicFooter(){const {locale}=await getPreferences(),settings=getSiteSettings(),c=createTranslator(locale),year=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric'}).format(new Date(requestTime())),institution=settings.institutionName[locale];return <footer className="mt-12 border-t border-border bg-background" dir={locale==='ar'?'rtl':'ltr'}><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><div className="flex max-w-xl flex-col items-start gap-3"><Brand en={locale==='en'}/><p className="text-sm leading-relaxed text-muted-foreground">{settings.footerDescription[locale].split(/(لُبّ?)/u).map((part,index)=>/^لُبّ?$/u.test(part)?<LubBrandName key={index} text={part}/>:part)}</p></div><div className="flex flex-col gap-4">{settings.legalPublished&&<nav className="flex flex-wrap gap-4" aria-label={c('روابط قانونية','Legal links')}><Link className="text-sm hover:underline" href="/privacy">{c('سياسة الخصوصية','Privacy policy')}</Link><Link className="text-sm hover:underline" href="/terms">{c('الشروط والأحكام','Terms and conditions')}</Link></nav>}<FooterContactIcons contacts={settings.contacts} locale={locale}/></div></div><Separator/><p className="text-sm text-muted-foreground">© {year}{institution?` · ${institution}`:''}. {c('جميع الحقوق محفوظة.','All rights reserved.')}</p></div></footer>;}
