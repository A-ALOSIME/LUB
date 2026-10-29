import {t as translateUi} from "@/lib/i18n";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { getPreferences } from "@/lib/preferences";
export default async function NotFound() {
  const {locale}=await getPreferences(),en=locale==="en";
  return <><PublicHeader /><main id="main" className="mx-auto max-w-2xl px-5 py-20"><h1 className="text-3xl font-bold">{translateUi((en) ? "en" : "ar", "الصفحة غير موجودة", "Page not found")}</h1><p className="my-6 text-muted">{translateUi((en) ? "en" : "ar", "قد يكون الرابط تغيّر. تقدر ترجع للرئيسية وتكمل من هناك.", "The link may have changed. Return home to keep exploring.")}</p><Link href="/" className="button">{translateUi((en) ? "en" : "ar", "العودة للرئيسية", "Back to home")}</Link></main></>;
}
