import {t as translateUi} from "@/lib/i18n";
import {getPreferences} from "@/lib/preferences";
export async function StorageUnavailable() {
  const en=(await getPreferences()).locale==="en";
  return <main id="main" className="mx-auto max-w-2xl px-5 py-16"><h1 className="text-3xl font-bold">{translateUi((en) ? "en" : "ar", "ملفك غير متاح الآن", "Your profile is unavailable")}</h1><p className="mt-5 leading-8 text-muted">{translateUi((en) ? "en" : "ar", "تعذّر الوصول لخدمة حفظ البيانات. حاول بعد قليل؛ لم تُحفظ أي تغييرات.", "The data service could not be reached. Please try later; no changes were saved.")}</p></main>;
}
