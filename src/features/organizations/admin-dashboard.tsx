
import {ContentText} from "@/components/content-text";
import {t as translateUi} from "@/lib/i18n";
import {NumberText} from "@/components/number-text";
import type { Locale } from "@/lib/preferences";

type Summary = {
  activeOrganizations: number;
  archivedOrganizations: number;
  administrators: number;
};

function SectionIcon({ name }: { name: "organizations" | "admins" | "terms" | "account" }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.7 };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" {...common}>
    {name === "organizations" && <><path d="m3 9 9-5 9 5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 21v-8h6v8M3 9h18" /></>}
    {name === "admins" && <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20zM16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 3.5 4.4V20h-3" /></>}
    {name === "terms" && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6" /></>}
    {name === "account" && <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0M18 8h4M20 6v4" /></>}
  </svg>;
}

export function SuperAdminDashboard({ locale, summary, notice }: {
  locale: Locale;
  summary: Summary;
  notice?: string;
}) {
  const en = locale === "en";
  const stats = [
    { label: translateUi((en) ? "en" : "ar", "الجهات النشطة", "Active organizations"), value: summary.activeOrganizations, name: "organizations" as const },
    { label: translateUi((en) ? "en" : "ar", "الجهات المؤرشفة", "Archived organizations"), value: summary.archivedOrganizations, name: "organizations" as const },
    { label: translateUi((en) ? "en" : "ar", "مشرفو النظام", "System administrators"), value: summary.administrators, name: "admins" as const },
  ];

  return <div className="workspace-content workspace-admin-overview">
    <header id="overview" className="workspace-page-header">
      <h1>{translateUi((en) ? "en" : "ar", "نظرة عامة", "System overview")}</h1>
    </header>
    {notice === "organization-created" && <p role="status" className="panel p-4 text-action">{translateUi((en) ? "en" : "ar", "تم إنشاء الجهة. يمكنك الآن تعيين قائدها الأساسي.", "Organization created. You can now appoint its primary leader.")}</p>}
    <section aria-label={translateUi((en) ? "en" : "ar", "ملخص النظام", "System summary")} className="workspace-summary-grid">
      {stats.map(stat => <div key={stat.label} className="workspace-summary-item">
        <span aria-hidden="true" className="workspace-summary-icon"><SectionIcon name={stat.name} /></span>
        <span className="min-w-0"><span className="workspace-summary-label"><ContentText value={stat.label}/></span><strong className="workspace-summary-value"><NumberText value={stat.value}/></strong></span>
      </div>)}
    </section>
  </div>;
}
