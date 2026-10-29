import {t as translateUi} from "@/lib/i18n";
import {localizedMetadata} from "@/lib/localized-metadata";
import { requireUser } from "@/features/auth/session";
import { AccountHeader } from "@/components/account-header";
import { getPreferences } from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('الحساب غير نشط','Account unavailable');}
export default async function AccountUnavailable() {
  await requireUser();
  const en=(await getPreferences()).locale==="en";
  return <><AccountHeader /><main id="main" className="mx-auto max-w-2xl px-5 py-16"><h1 className="text-3xl font-bold">{translateUi((en) ? "en" : "ar", "الحساب غير نشط", "Account inactive")}</h1><p className="mt-5 leading-8 text-muted">{translateUi((en) ? "en" : "ar", "تواصل مع مسؤول النظام للمساعدة في إعادة تفعيل حسابك.", "Contact the system administrator for help reactivating your account.")}</p></main></>;
}
