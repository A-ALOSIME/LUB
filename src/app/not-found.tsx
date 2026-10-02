import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { getPreferences } from "@/lib/preferences";
export default async function NotFound() {
  const {locale}=await getPreferences(),en=locale==="en";
  return <><PublicHeader /><main id="main" className="mx-auto max-w-2xl px-5 py-20"><h1 className="text-3xl font-bold">{en?"Page not found":"الصفحة غير موجودة"}</h1><p className="my-6 text-muted">{en?"The link may have changed. Return home to keep exploring.":"قد يكون الرابط تغيّر. تقدر ترجع للرئيسية وتكمل من هناك."}</p><Link href="/" className="button">{en?"Back to home":"العودة للرئيسية"}</Link></main></>;
}
