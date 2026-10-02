import {localizedMetadata} from "@/lib/localized-metadata";
import { AuthPage } from "@/components/auth-page";
import { safeReturnPath } from "@/features/auth/return-path";
export async function generateMetadata(){return localizedMetadata('إنشاء حساب','Sign up');}
export default async function Signup({searchParams}: {searchParams:Promise<{next?:string}>}) { const {next}=await searchParams; return <AuthPage mode="signup" returnTo={safeReturnPath(next)} />; }
