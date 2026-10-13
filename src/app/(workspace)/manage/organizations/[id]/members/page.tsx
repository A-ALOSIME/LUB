import { notFound } from "next/navigation";
import { z } from "zod";
import { getPreferences } from "@/lib/preferences";
import { requireManagementUser } from "@/features/organizations/access";
import { getOrganizationMemberDirectory, getOrganizationPermissionWorkspace } from "@/features/organizations/management-repository";
import { MemberDirectory } from "./member-directory";
import { PermissionEditor } from "./permission-editor";

export default async function OrganizationMembersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string | string[] }> }) {
  const [{ id }, search, { locale }, user] = await Promise.all([params, searchParams, getPreferences(), requireManagementUser()]);
  if (!z.uuid().safeParse(id).success) notFound();
  const permissions = search.view === "permissions";

  if (permissions) {
    const workspace = await getOrganizationPermissionWorkspace(user.id, id);
    if (!workspace) notFound();
    const en = locale === "en";
    return <div className="workspace-content organization-members-page">
      <header className="workspace-page-header"><div><p className="workspace-eyebrow">{en ? "ORGANIZATION WORKSPACE" : "مساحة إدارة الجهة"}</p><h1 className="mt-2 text-3xl font-bold">{en ? "Roles and permissions" : "الأدوار والتفويضات"}</h1><p className="mt-3 text-muted">{en ? "Grant access in one place, with clear scope and expiry." : "إدارة كل التفويضات من مكان واحد مع تحديد النطاق وموعد الانتهاء."}</p></div></header>
      <PermissionEditor organization={id} workspace={workspace} committees={workspace.committees} locale={locale}/>
    </div>;
  }

  const workspace = await getOrganizationMemberDirectory(user.id, id);
  if (!workspace) notFound();
  const en = locale === "en";
  return <div className="workspace-content organization-members-page">
    <header className="workspace-page-header"><div><p className="workspace-eyebrow">{en ? "ORGANIZATION WORKSPACE" : "مساحة إدارة الجهة"}</p><h1 className="mt-2 text-3xl font-bold">{en ? "Member directory" : "قاعدة بيانات الأعضاء"}</h1><p className="mt-3 text-muted">{en ? "Review active and past memberships, roles and approved hours." : "استعرض العضويات والأدوار والساعات المعتمدة مع الاحتفاظ بالسجل التاريخي."}</p></div></header>
    <MemberDirectory organization={id} workspace={workspace} locale={locale}/>
  </div>;
}
