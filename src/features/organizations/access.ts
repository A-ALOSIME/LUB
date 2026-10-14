import "server-only";
import { redirect } from "next/navigation";
import { requireUser, requireVerifiedProxyIdentity } from "@/features/auth/session";
import { getAccountReadiness } from "@/features/profile/repository";
import { isSuperAdminUser, requireStudentUser } from "@/features/auth/authorization";

async function verifyManagementUser(identity: { id: string }) {
  const [user, readiness] = await Promise.all([
    requireUser(),
    getAccountReadiness(identity.id).catch(() => { throw new Error("Management storage is unavailable."); }),
  ]);
  if (user.id !== identity.id) redirect("/login");
  const { status, onboarded } = readiness;
  if (status === "Inactive") redirect("/account-unavailable");
  if (!onboarded && !(await isSuperAdminUser(user.id))) redirect("/onboarding");
  return user;
}

export async function requireManagementUser() {
  return verifyManagementUser(await requireVerifiedProxyIdentity());
}

export async function loadManagementPageData<T>(load: (userId: string) => Promise<T>) {
  const identity = await requireVerifiedProxyIdentity();
  const dataPromise = load(identity.id).then(
    value => ({ ok: true as const, value }),
    error => ({ ok: false as const, error }),
  );
  const [user, result] = await Promise.all([verifyManagementUser(identity), dataPromise]);
  if (!result.ok) throw result.error;
  return { user, data: result.value };
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
