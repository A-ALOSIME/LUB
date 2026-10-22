import type { ReactNode } from "react";
import { OrganizationManagementFrame } from "@/features/organizations/organization-management-frame";
import { getPreferences } from "@/lib/preferences";

export default async function OrganizationManagementLayout({ children }: { children: ReactNode }) {
  const { locale } = await getPreferences();
  return <OrganizationManagementFrame locale={locale}>{children}</OrganizationManagementFrame>;
}
