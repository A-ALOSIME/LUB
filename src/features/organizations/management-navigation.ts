import "server-only";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { getAdminAccountProfile, getManagementOverview } from "./management-repository";

export async function hasSuperAdminNavigationAccess(
  managementView: string | null,
  userId: string | undefined,
  nonce?: string,
) {
  if (!userId || managementView === "organizations") return false;
  if (managementView === "dashboard") {
    return (await getManagementOverview(userId, nonce)).access.superAdmin;
  }
  if (managementView === "account") {
    try {
      await getAdminAccountProfile(userId);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") return false;
      throw error;
    }
  }
  return isSuperAdminUser(userId);
}
