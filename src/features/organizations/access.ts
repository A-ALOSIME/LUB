import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { getAccountReadiness } from "@/features/profile/repository";
import { isSuperAdminUser, requireStudentUser } from "@/features/auth/authorization";

export async function requireManagementUser() {
  const user = await requireUser();
  let status: string | undefined;
  let onboarded = false;
  try { ({ status, onboarded } = await getAccountReadiness(user.id)); }
  catch { throw new Error("Management storage is unavailable."); }
  if (status === "Inactive") redirect("/account-unavailable");
  if (!onboarded && !(await isSuperAdminUser(user.id))) redirect("/onboarding");
  return user;
}

export async function requireStudentManagementUser() {
  const user = await requireStudentUser();
  let status: string | undefined;
  let onboarded = false;
  try { ({ status, onboarded } = await getAccountReadiness(user.id)); }
  catch { throw new Error("Management storage is unavailable."); }
  if (status === "Inactive") redirect("/account-unavailable");
  if (!onboarded) redirect("/onboarding");
  return user;
}
