import "server-only";
import { sql } from "drizzle-orm";
import { withUser } from "@/db/client";
import { talentOrganizationLogo } from "@/features/talent/repository";
import type { StudentProfile } from "@/features/profile/repository";
import type { getManagementOverview, MembershipHistoryRow } from "./management-repository";

type MyPageData = {
  status?: string;
  profile?: (StudentProfile & { nameEn: string | null }) | null;
  access: Awaited<ReturnType<typeof getManagementOverview>>["access"];
  memberships: MembershipHistoryRow[];
  tasks: Array<{ id: string; title: string; status: string }>;
  hours: string;
};

export async function getMyPageData(user: string): Promise<MyPageData> {
  return withUser(user, async tx => {
    const [row] = await tx.execute<{ data: MyPageData | null }>(sql`select lub.own_workspace_page() as data`);
    if (!row?.data) return { access: { superAdmin: false, organizations: [] }, memberships: [], tasks: [], hours: "0" };
    return { ...row.data, memberships: row.data.memberships.map(m => ({ ...m, logo: talentOrganizationLogo(m.organizationName, m.logo) })) };
  });
}
