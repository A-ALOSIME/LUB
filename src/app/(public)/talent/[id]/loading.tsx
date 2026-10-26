import { Skeleton } from "@/components/ui/skeleton";
import { getPreferences } from "@/lib/preferences";
export default async function Loading() {
  const { locale } = await getPreferences();
  return (
    <main
      id="main"
      aria-busy="true"
      aria-label={locale === "en" ? "Loading profile" : "جارٍ تحميل الملف"}
      className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-8"
    >
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </main>
  );
}
