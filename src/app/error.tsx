"use client";
import { LocalizedText } from "@/components/localized-text";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="mx-auto max-w-2xl px-5 py-20"><h1 className="text-3xl font-bold"><LocalizedText ar="تعذّر تحميل الصفحة" en="Page could not load"/></h1><p className="my-6 text-muted"><LocalizedText ar="حاول مرة ثانية بعد قليل." en="Please try again shortly."/></p><button onClick={reset} className="button"><LocalizedText ar="إعادة المحاولة" en="Try again"/></button></main>;
}
