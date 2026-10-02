import Link from "next/link";
import { AccountHeader } from "@/components/account-header";
import { getPreferences } from "@/lib/preferences";

export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  const en=(await getPreferences()).locale==="en";
  return <><AccountHeader /><div className="mx-auto grid max-w-7xl items-start gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
    <aside className="panel p-5"><nav aria-label={en?"Management navigation":"تنقل الإدارة"} className="flex flex-wrap gap-5 lg:flex-col"><Link href="/manage" className="font-semibold text-action">{en?"Management":"إدارتي"}</Link><Link href="/organizations" className="text-sm font-medium">{en?"Browse organizations":"تصفح الجهات"}</Link><Link href="/me" className="text-sm font-medium">{en?"My page":"صفحتي"}</Link></nav></aside>
    <main id="main" className="min-w-0">{children}</main>
  </div></>;
}
