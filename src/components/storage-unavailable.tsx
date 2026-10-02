import {getPreferences} from "@/lib/preferences";
export async function StorageUnavailable() {
  const en=(await getPreferences()).locale==="en";
  return <main id="main" className="mx-auto max-w-2xl px-5 py-16"><h1 className="text-3xl font-bold">{en?"Your profile is unavailable":"ملفك غير متاح الآن"}</h1><p className="mt-5 leading-8 text-muted">{en?"The data service could not be reached. Please try later; no changes were saved.":"تعذّر الوصول لخدمة حفظ البيانات. حاول بعد قليل؛ لم تُحفظ أي تغييرات."}</p></main>;
}
