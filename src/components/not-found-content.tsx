import Link from "next/link";
import {getPreferences} from "@/lib/preferences";
import {createTranslator} from "@/lib/i18n";
export async function NotFoundContent(){
 const {locale}=await getPreferences(),t=createTranslator(locale);
 return <main id="main" className="mx-auto w-full min-w-0 max-w-2xl px-5 py-20"><h1 className="text-3xl font-bold">{t("الصفحة غير موجودة","Page not found")}</h1><p className="my-6 text-muted-foreground">{t("قد يكون الرابط تغيّر. تقدر ترجع للرئيسية وتكمل من هناك.","The link may have changed. Return home to keep exploring.")}</p><Link href="/" className="button">{t("العودة للرئيسية","Back to home")}</Link></main>;
}
