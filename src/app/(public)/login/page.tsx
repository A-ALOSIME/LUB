import {localizedMetadata} from "@/lib/localized-metadata";
import { safeReturnPath } from "@/features/auth/return-path";
import { AuthPage } from "@/components/auth-page";
export async function generateMetadata(){return localizedMetadata('تسجيل الدخول','Log in');}
export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string; next?: string }> }) {
  const { notice, next } = await searchParams;
  return <AuthPage returnTo={safeReturnPath(next)} mode="login" invalidLink={notice === "link-invalid"} />;
}
