import Link from "next/link";
import type { Locale } from "@/lib/preferences";
import { formatPersonalNumber } from "./personal-display";

export type ManagedOrganizationLink = {
  id: string;
  nameAr: string;
  statusCode: string;
  canEdit: boolean;
  canManageCommittees: boolean;
  canApplications: boolean;
  canEvents: boolean;
  canReports: boolean;
  canHours: boolean;
  canRenewals: boolean;
  canTasks: boolean;
  canMembers: boolean;
  canGrant: boolean;
};

type NavigationItem = { href: string; label: string };

export function MyPageNavigation({
  locale,
  organizations,
  sectionBase = "",
  superAdmin = false,
}: {
  locale: Locale;
  organizations: ManagedOrganizationLink[];
  sectionBase?: string;
  superAdmin?: boolean;
}) {
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const itemClass = "workspace-sidebar-link";
  const subsectionClass = "workspace-sidebar-sublink";
  const sectionHref = (id: string) => superAdmin ? `/manage#${id}` : sectionBase ? `${sectionBase}#${id}` : `#${id}`;
  const groups: Array<{ title: string; items: NavigationItem[] }> = superAdmin
    ? [
      { title: c("الحساب", "ACCOUNT"), items: [{ href: "/manage/account", label: c("إعدادات الحساب", "Account settings") }] },
      {
        title: c("إدارة النظام", "SYSTEM ADMINISTRATION"),
        items: [
          { href: "/manage/organizations", label: c("الجهات", "Organizations") },
          { href: "/manage/admins", label: c("المشرفون العامون", "Administrators") },
          { href: "/manage/terms", label: c("الفصول الأكاديمية", "Academic terms") },
        ],
      },
    ]
    : [
      {
        title: c("حسابي", "ACCOUNT"),
        items: [
          { href: "/account", label: c("بيانات الحساب", "Account settings") },
          { href: "/applications", label: c("طلباتي", "My applications") },
          { href: "/notifications", label: c("الإشعارات", "Notifications") },
          { href: "/account/talent", label: c("ملفي المهاري", "Skills profile") },
          { href: sectionHref("tasks"), label: c("المهام والمشاركات", "Tasks and participation") },
          { href: "/hours", label: c("سجل الساعات", "Hours history") },
          { href: "/renewals", label: c("طلبات التجديد", "Membership renewals") },
          { href: "/documents", label: c("مستنداتي", "My documents") },
          { href: sectionHref("events"), label: c("فعالياتي", "My events") },
        ],
      },
    ];

  return <aside aria-label={c("تنقل مساحتي", "My workspace navigation")} className="workspace-sidebar panel">
    <div className="workspace-sidebar-overview">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="workspace-sidebar-mark">
          <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="workspace-eyebrow">{superAdmin ? c("مساحة الإدارة", "ADMIN WORKSPACE") : c("مساحة موحدة", "ONE WORKSPACE")}</p>
          <p className="mt-0.5 text-lg font-bold leading-7">{superAdmin ? c("مساحتي", "My workspace") : c("صفحتي وإدارتي", "My page and management")}</p>
        </div>
      </div>
      <Link href={sectionHref("overview")} prefetch={false} className={`${itemClass} workspace-sidebar-link--overview mt-3`}>
        <span>{c("نظرة عامة", "Overview")}</span>
      </Link>
    </div>

    <nav aria-label={c("أقسام مساحتي", "Workspace sections")} className="workspace-sidebar-nav">
      {groups.map(group => <section key={group.title} className="workspace-sidebar-group" aria-label={group.title}>
        <h2 className="workspace-sidebar-section-heading">{group.title}</h2>
        <ul className="workspace-sidebar-list">
          {group.items.map(item => <li key={item.href}>
            <Link href={item.href} prefetch={false} className={itemClass}>{item.label}</Link>
          </li>)}
        </ul>
      </section>)}

      {!superAdmin && organizations.length > 0 && <section className="workspace-sidebar-group" aria-labelledby="workspace-management-title">
        <div className="workspace-sidebar-section-heading">
          <h2 id="workspace-management-title">{c("إدارة الجهات", "ORGANIZATIONS YOU MANAGE")}</h2>
          <span className="workspace-sidebar-count">{formatPersonalNumber(organizations.length, locale)}</span>
        </div>
        <ul className="workspace-sidebar-organization-list">
          {organizations.map(organization => {
            const root = `/manage/organizations/${organization.id}`;
            const managementLinks: NavigationItem[] = [
              { href: root, label: c("بيانات الجهة", "Organization details") },
              ...(organization.canManageCommittees ? [{ href: `${root}#committees`, label: c("اللجان", "Committees") }] : []),
              ...(organization.canApplications ? [{ href: `${root}/applications`, label: c("طلبات الأعضاء", "Member applications") }] : []),
              ...(organization.canMembers ? [{ href: `${root}/members`, label: c("قاعدة الأعضاء", "Member directory") }] : []),
              ...(organization.canGrant ? [{ href: `${root}/permissions`, label: c("الأدوار والتفويضات", "Roles and permissions") }] : []),
              ...(organization.canEvents ? [{ href: `${root}/events`, label: c("فعاليات الجهة", "Organization events") }] : []),
              ...(organization.canReports ? [{ href: `${root}/documents`, label: c("التقارير والمستندات", "Reports and documents") }] : []),
              ...(organization.canHours ? [{ href: `${root}/hours`, label: c("الساعات", "Hours") }] : []),
              ...(organization.canRenewals ? [{ href: `${root}/renewals`, label: c("تجديد العضوية", "Membership renewals") }] : []),
              ...(organization.canTasks ? [{ href: `${root}/tasks`, label: c("المهام والقوالب", "Tasks and templates") }] : []),
            ];

            return <li key={organization.id} className="workspace-sidebar-organization">
              <Link href={root} prefetch={false} aria-label={organization.nameAr} className={`${itemClass} workspace-sidebar-organization-link`}>
                <span className="workspace-sidebar-organization-name">
                  <span aria-hidden="true" className="workspace-sidebar-organization-mark">{organization.nameAr.trim().slice(0, 1)}</span>
                  <span dir="auto" className="min-w-0 break-words">{organization.nameAr}</span>
                </span>
                <span className={`workspace-status ${organization.statusCode === "Active" ? "is-current" : ""}`}>{en ? organization.statusCode : organization.statusCode === "Active" ? "نشطة" : organization.statusCode === "Archived" ? "مؤرشفة" : "غير نشطة"}</span>
              </Link>
              {managementLinks.length > 0 && <ul aria-label={`${organization.nameAr} · ${c("أقسام الإدارة", "management sections")}`} className="workspace-sidebar-subnav">
                {managementLinks.map(item => <li key={item.href}>
                  <Link href={item.href} prefetch={false} className={subsectionClass}>
                    <span aria-hidden="true" className="workspace-sidebar-dot" />
                    <span>{item.label}</span>
                  </Link>
                </li>)}
              </ul>}
            </li>;
          })}
        </ul>
      </section>}
    </nav>
  </aside>;
}
