import Image from "next/image";
import { PublicHeader } from "./public-header";
import { AuthForm } from "@/features/auth/auth-form";
import { getAuthConfig } from "@/lib/env";
import { getPreferences } from "@/lib/preferences";

export async function AuthPage({ mode, invalidLink = false, returnTo = "/me" }: { mode: "login" | "signup"; invalidLink?: boolean; returnTo?: string }) {
  const locale = (await getPreferences()).locale;
  const en = locale === "en";
  return <><PublicHeader /><main id="main" className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[1fr_1fr] lg:items-stretch">
    <section className="auth-intro relative overflow-hidden rounded-2xl px-7 py-10 sm:px-10 sm:py-14"><Image src="/brand/symbol-reversed.svg" alt="" width={100} height={100} aria-hidden="true" className="absolute -bottom-16 -left-14 h-auto w-64 opacity-10" /><div className="relative"><p className="mb-4 text-sm text-[#bad3e6]">{en?"LUB · Your space to participate":"لُبّ · مساحة مشاركتك"}</p><h1 className="max-w-md text-4xl leading-[1.35] sm:text-5xl">{en?mode==="signup"?"Your journey starts here.":"Welcome back.":mode === "signup" ? "بداية مشاركتك هنا." : "أهلًا بعودتك."}</h1><p className="mt-6 max-w-md leading-8 text-[#d8e4ed]">{en?mode==="signup"?"One account for all your memberships. Enter your email, then complete your basic details once.":"Sign in to follow your memberships, activities, and approved hours.":mode === "signup" ? "حساب واحد لكل عضوياتك. أدخل بريدك، ثم أكمل بياناتك الأساسية مرة واحدة." : "ادخل لحسابك وتابع عضوياتك، مشاركاتك، وساعاتك المعتمدة."}</p><p className="mt-10 max-w-md border-s-2 border-[#94bce3] ps-4 text-sm leading-7 text-[#c9d9e5]">{en?"Your university number stays private. Your public profile is your choice.":"رقمك الجامعي يبقى خاصًا، وملفك العام يظهر باختيارك."}</p></div></section>
    <section className="panel flex flex-col justify-center p-7 sm:p-10" aria-labelledby="form-title"><h2 id="form-title" className="mb-7 text-2xl font-bold">{en?mode==="signup"?"Sign up":"Log in":mode === "signup" ? "إنشاء حساب" : "تسجيل الدخول"}</h2>{invalidLink && <p role="alert" className="error-message mb-6">{en?"This verification attempt could not be completed. Request a new code below.":"تعذّر إكمال التحقق. اطلب رمزًا جديدًا أدناه."}</p>}<AuthForm returnTo={returnTo} mode={mode} available={Boolean(getAuthConfig())} locale={locale} /></section>
  </main></>;
}
