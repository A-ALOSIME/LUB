import { notFound } from "next/navigation";
import { z } from "zod";
import { getPreferences } from "@/lib/preferences";
import { loadManagementPageData } from "@/features/organizations/access";
import { getOrganizationMemberDirectory, getOrganizationPermissionWorkspace } from "@/features/organizations/management-repository";
import { MemberDirectory } from "./member-directory";
import { PermissionEditor } from "../permissions/permission-editor";
import { localizedMetadata } from "@/lib/localized-metadata";
import { countOrganizationApplicationStatuses, getWorkspace, type Filters } from "@/features/forms/repository";
import { ApplicationsTab } from "./applications-tab";
import { OrganizationMembersTabs } from "@/features/organizations/organization-members-tabs";

export async function generateMetadata() {
  return localizedMetadata("الأعضاء", "Members");
}

export default async function OrganizationMembersPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, { locale }, search] = await Promise.all([params, getPreferences(), searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, data: [workspace, permissions, applicationWorkspace] } = await loadManagementPageData(userId => Promise.all([
    getOrganizationMemberDirectory(userId, id),
    getOrganizationPermissionWorkspace(userId, id),
    getWorkspace(userId, id),
  ]));
  const showMembers = Boolean(workspace || permissions);
  const showApplications = Boolean(applicationWorkspace?.allowed.some(code => ["APPLICATIONS_VIEW", "APPLICATIONS_REVIEW", "APPLICATIONS_BULK_ACTION"].includes(code)));
  if (!showMembers && !showApplications) notFound();
  const applicationFilters: Filters = { q: "", status: "", committee: "", major: "", level: "", from: "", to: "", page: 1, lookup: "", activity: "" };
  const pendingStatuses = showApplications ? await countOrganizationApplicationStatuses(user.id, id, applicationFilters) : undefined;
  const pendingCount = pendingStatuses?.submitted ?? 0;
  const requestedSection = typeof search.section === "string" ? search.section : "";
  const initialTab = requestedSection === "applications" && showApplications ? "applications" : showMembers ? "members" : "applications";
  const memberPanel = workspace
    ? <MemberDirectory organization={id} workspace={workspace} permissions={permissions} locale={locale}/>
    : permissions
      ? <PermissionEditor organization={id} workspace={permissions} committees={permissions.committees} locale={locale}/>
      : null;
  const applicationsPanel = showApplications && applicationWorkspace
    ? <ApplicationsTab organization={id} userId={user.id} workspace={applicationWorkspace} locale={locale} search={search}/>
    : null;
  return <div className="workspace-content organization-members-page">
    <OrganizationMembersTabs
      locale={locale}
      initialTab={initialTab}
      pendingCount={pendingCount}
      memberPanel={memberPanel}
      applicationsPanel={applicationsPanel}
      showMembers={showMembers}
      showApplications={showApplications}
    />
  </div>;
}
