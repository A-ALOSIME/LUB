import { notFound } from "next/navigation";
import { z } from "zod";
import { getPreferences } from "@/lib/preferences";
import { requireManagementUser } from "@/features/organizations/access";
import { getOrganizationMemberDirectory } from "@/features/organizations/management-repository";
import { MemberDirectory } from "./member-directory";

export default async function OrganizationMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { locale }, user] = await Promise.all([params, getPreferences(), requireManagementUser()]);
  if (!z.uuid().safeParse(id).success) notFound();
  const workspace = await getOrganizationMemberDirectory(user.id, id);
  if (!workspace) notFound();
  const en = locale === "en";
  return <div className="workspace-content organization-members-page">
    <header className="workspace-page-header"><div><p className="workspace-eyebrow">{en ? "ORGANIZATION WORKSPACE" : "مساحة إدارة الجهة"}</p><h1 className="mt-2 text-3xl font-bold">{en ? "Member directory" : "قاعدة بيانات الأعضاء"}</h1><p className="mt-3 text-muted">{en ? "Review active and past memberships, roles and approved hours." : "استعرض العضويات والأدوار والساعات المعتمدة مع الاحتفاظ بالسجل التاريخي."}</p></div></header>
    <MemberDirectory organization={id} workspace={workspace} locale={locale}/>
  </div>;
}
