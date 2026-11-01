import {notFound} from "next/navigation";
import {getVerifiedUser} from "@/features/auth/session";
import {isSuperAdminUser} from "@/features/auth/authorization";
import {getPreferences} from "@/lib/preferences";
import {getSiteSettings} from "@/lib/site-settings";
import {formatRiyadhDate} from "@/lib/datetime";
import {createTranslator} from "@/lib/i18n";
import {Alert,AlertTitle,AlertDescription} from "@/components/ui/alert";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {legalContent} from "./content";
export async function LegalPage({kind}:{kind:keyof typeof legalContent}){const settings=getSiteSettings();if(!settings.legalPublished){const user=await getVerifiedUser();if(!user||!await isSuperAdminUser(user.id))notFound();}const {locale}=await getPreferences(),c=createTranslator(locale),content=legalContent[kind];return <main id="main" dir={locale==='ar'?'rtl':'ltr'} className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10 sm:px-8"><h1 className="text-3xl font-semibold">{content.title[locale]}</h1>{!settings.legalPublished&&<Alert><AlertTitle>{c('مسودة للمراجعة','Draft for review')}</AlertTitle><AlertDescription>{c('لم تُنشر هذه الصفحة للعامة بعد.','This page has not been published yet.')}</AlertDescription></Alert>}<p className="text-sm text-muted-foreground">{c('آخر تحديث:','Last updated:')} {formatRiyadhDate(settings.legalUpdatedAt,locale)}</p>{content.sections.map(section=><Card key={section.title.en}><CardHeader><CardTitle>{section.title[locale]}</CardTitle></CardHeader><CardContent><p className="leading-relaxed">{section.body[locale]}</p></CardContent></Card>)}{settings.contacts.email&&<p><a className="text-primary underline" dir="ltr" href={`mailto:${settings.contacts.email}`}>{settings.contacts.email}</a></p>}</main>;}
