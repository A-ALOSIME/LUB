import "server-only";
import { eq } from "drizzle-orm";
import { withUser } from "@/db/client";
import { users, studentProfiles, profileSettings, auditLog } from "@/db/schema";
import { encryptIdentifier, identifierLookup } from "@/lib/identifiers";
import type { ProfileInput } from "@/lib/validation";
import type { VerifiedUser } from "@/features/auth/session";

export async function getAccountStatus(userId: string) {
  return withUser(userId, async (tx) => {
    const [account] = await tx.select({ status: users.statusCode }).from(users).where(eq(users.id, userId)).limit(1);
    return account?.status;
  });
}

export async function getAccountReadiness(userId: string) {
  return withUser(userId, async tx => {
    const [account] = await tx.select({ status: users.statusCode, onboarded: studentProfiles.userId }).from(users)
      .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id)).where(eq(users.id, userId)).limit(1);
    return { status: account?.status, onboarded: Boolean(account?.onboarded) };
  });
}

export async function getStudentProfile(userId: string) {
  return withUser(userId, async (tx) => {
    const [profile] = await tx.select({
      fullName: studentProfiles.fullNameAr, major: studentProfiles.majorName,
      academicLevel: studentProfiles.academicLevel, phone: users.phone,
      publicProfileEnabled: profileSettings.publicProfileEnabled, showTotalHours: profileSettings.showTotalHours,
    }).from(studentProfiles)
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .innerJoin(profileSettings, eq(profileSettings.userId, studentProfiles.userId))
      .where(eq(studentProfiles.userId, userId)).limit(1);
    return profile;
  });
}
export type StudentProfile = NonNullable<Awaited<ReturnType<typeof getStudentProfile>>>;

export async function saveStudentProfile(user: VerifiedUser, input: ProfileInput) {
  return withUser(user.id, async (tx) => {
    const [account] = await tx.select({ status: users.statusCode }).from(users).where(eq(users.id, user.id)).limit(1);
    if (account && account.status !== "Active") throw new Error("Account is inactive.");
    const [existing] = await tx.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.userId, user.id)).limit(1);
    if (!existing && !input.universityId) throw new Error("University number is required for onboarding.");
    if (existing && input.universityId) throw new Error("University number changes require a dedicated audited correction.");
    const updatedAt = new Date();
    const identity = { email: user.email.toLowerCase(), phone: input.phone || null, emailVerifiedAt: new Date(user.emailVerifiedAt), updatedAt };
    await tx.insert(users).values({ id: user.id, ...identity }).onConflictDoUpdate({ target: users.id, set: identity });
    const profile = { fullNameAr: input.fullName, majorName: input.major, academicLevel: input.academicLevel, updatedAt };
    if (existing) {
      await tx.update(studentProfiles).set(profile).where(eq(studentProfiles.userId, user.id));
    } else if (input.universityId) {
      await tx.insert(studentProfiles).values({ userId: user.id, ...profile, universityIdCiphertext: encryptIdentifier(input.universityId, user.id), universityIdLookupHash: identifierLookup(input.universityId) });
    }
    const settings = { publicProfileEnabled: input.publicProfileEnabled, showTotalHours: input.showTotalHours, updatedAt };
    await tx.insert(profileSettings).values({ userId: user.id, ...settings }).onConflictDoUpdate({ target: profileSettings.userId, set: settings });
    await tx.insert(auditLog).values({
      actorUserId: user.id, actionCode: existing ? "PROFILE_UPDATED" : "PROFILE_CREATED",
      entityType: "student_profiles", entityId: user.id,
      metadata: { publicProfileEnabled: input.publicProfileEnabled, showTotalHours: input.showTotalHours },
    });
  });
}
