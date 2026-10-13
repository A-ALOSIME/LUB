import { notFound } from "next/navigation";
import { z } from "zod";
import { getPreferences } from "@/lib/preferences";
import { requireManagementUser } from "@/features/organizations/access";
import { getOrganizationPermissionWorkspace } from "@/features/organizations/management-repository";
import { PermissionEditor } from "./permission-editor";

export default async function OrganizationPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { locale }, user] = await Promise.all([params, getPreferences(), requireManagementUser()]);
  if (!z.uuid().safeParse(id).success) notFound();

  const workspace = await getOrganizationPermissionWorkspace(user.id, id);
  if (!workspace) notFound();
  const en = locale === "en";

  return <div className="workspace-content organization-members-page">
    <header className="workspace-page-header"><div>
      <p className="workspace-eyebrow">{en ? "ORGANIZATION WORKSPACE" : "مساحة إدارة الجهة"}</p>
      <h1 className="mt-2 text-3xl font-bold">{en ? "Roles and permissions" : "الأدوار والتفويضات"}</h1>
      <p className="mt-3 text-muted">{en ? "Grant, review, or end every organization permission from one place." : "امنح صلاحيات الجهة وراجعها وأنهِها من صفحة واحدة."}</p>
    </div></header>
    <PermissionEditor organization={id} workspace={workspace} committees={workspace.committees} locale={locale}/>
  </div>;
}
