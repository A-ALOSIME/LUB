import {t as translateUi} from "@/lib/i18n";
import { getPreferences } from "@/lib/preferences";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
export default async function Loading() {
  const { locale } = await getPreferences();
  return (
    <main
      id="main"
      aria-busy="true"
      aria-label={translateUi((locale === "en") ? "en" : "ar", "جارٍ تحميل المواهب", "Loading talent")}
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8"
    >
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row gap-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-14 w-3/4" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-8 w-24" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  );
}
