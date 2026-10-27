import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, withUser } from "@/db/client";
import { users, studentProfiles } from "@/db/schema";
import {
  encryptIdentifier,
  decryptIdentifier,
  identifierLookup,
} from "@/lib/identifiers";
import { profileSchema, type ProfileInput } from "@/lib/validation";
import type { VerifiedUser } from "@/features/auth/session";

export async function getAccountStatus(userId: string) {
  return withUser(userId, async (tx) => {
    const [account] = await tx
      .select({ status: users.statusCode })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return account?.status;
  });
}

export async function getAccountReadiness(userId: string) {
  return withUser(userId, async (tx) => {
    const [account] = await tx
      .select({ status: users.statusCode, onboarded: studentProfiles.userId })
      .from(users)
      .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    return { status: account?.status, onboarded: Boolean(account?.onboarded) };
  });
}

export async function getStudentProfile(userId: string) {
  return withUser(userId, async (tx) => {
    const [profile] = await tx
      .select({
        fullName: studentProfiles.fullNameAr,
        major: studentProfiles.majorName,
        academicLevel: studentProfiles.academicLevel,
        phone: users.phone,
      })
      .from(studentProfiles)
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .where(eq(studentProfiles.userId, userId))
      .limit(1);
    return profile;
  });
}
export type StudentProfile = NonNullable<
  Awaited<ReturnType<typeof getStudentProfile>>
>;

export async function saveStudentProfile(
  user: VerifiedUser,
  input: ProfileInput,
) {
  const profile = profileSchema.parse(input);
  // Runtime-only function: the owner and confirmed email come from Supabase getUser.
  await getDb().execute(
    sql`select lub.save_student_account(${user.id},${user.email.toLowerCase()},${user.emailVerifiedAt}::timestamptz,${profile.fullName},${profile.major},${profile.academicLevel},${profile.phone},${profile.universityId ? encryptIdentifier(profile.universityId, user.id) : null},${profile.universityId ? identifierLookup(profile.universityId) : null},${encryptIdentifier(profile.nationalId, user.id, "national-id")},${identifierLookup(profile.nationalId, "national-id")})`,
  );
}

export type AccountProfile = StudentProfile & {
  universityId?: string;
  nationalId?: string;
};
export async function getAccountProfile(
  user: VerifiedUser,
): Promise<AccountProfile | undefined> {
  const profile = await getStudentProfile(user.id);
  if (!profile) return undefined;
  const rows = await getDb().execute(
    sql`select * from lub.read_student_identifiers(${user.id},${user.id})`,
  );
  const identifiers = rows[0];
  return {
    ...profile,
    universityId: identifiers?.university_cipher
      ? decryptIdentifier(String(identifiers.university_cipher), user.id)
      : undefined,
    nationalId: identifiers?.national_cipher
      ? decryptIdentifier(
          String(identifiers.national_cipher),
          user.id,
          "national-id",
        )
      : undefined,
  };
}
export async function syncVerifiedAccountEmail(user: VerifiedUser) {
  await getDb().execute(
    sql`select lub.sync_verified_account_email(${user.id},${user.email.toLowerCase()},${user.emailVerifiedAt}::timestamptz)`,
  );
}
