import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { studentOperationError } from "./authorization";
import { getAccountReadiness, saveStudentProfile } from "@/features/profile/repository";
import type { VerifiedUser } from "./session";
import type { ProfileInput } from "@/lib/validation";

export async function completeSignup(user: VerifiedUser, profile: ProfileInput) {
  if (await studentOperationError(user.id)) return "/manage";
  const readiness = await getAccountReadiness(user.id);
  if (readiness.status === "Inactive") return "/account-unavailable";
  if (readiness.onboarded) return undefined;

  await saveStudentProfile(user, profile);
  updateTag("public-organizations");
  updateTag("public-talent");
  revalidatePath("/me");
  revalidatePath("/account");
}
