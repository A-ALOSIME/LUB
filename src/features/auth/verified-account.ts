import "server-only";
import { cache } from "react";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { getVerifiedUser } from "@/features/auth/session";

export const getVerifiedAccountAccess = cache(async () => {
  const user = await getVerifiedUser();
  const isSuperAdmin = user ? await isSuperAdminUser(user.id) : false;
  return { user, isSuperAdmin };
});
