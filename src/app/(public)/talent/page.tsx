import { TalentSearch } from "@/features/talent/talent-search";
import {formatNumber,t as translateUi} from "@/lib/i18n";
import { localizedMetadata } from "@/lib/localized-metadata";
import { searchTalent } from "@/features/talent/repository";
import { TalentCards, TalentEmpty } from "@/features/talent/view";
import {
  parseTalentFilters,
  talentHref,
  type TalentQuery,
} from "@/features/talent/filters";
import { getPreferences } from "@/lib/preferences";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
export async function generateMetadata() {
  return localizedMetadata(
    "اكتشاف المواهب",
    "Talent discovery",
    {},
    {
      index: true,
      canonical: "/talent",
      description: {
        ar: "اكتشف مهارات الطلاب ومشاركاتهم وساعاتهم المعتمدة في لُبّ.",
        en: "Discover student skills, participation and approved activity through LUB.",
      },
    },
  );
}
export default async function TalentDirectory({
  searchParams,
}: {
  searchParams: Promise<TalentQuery>;
}) {
  const [query, { locale }] = await Promise.all([
    searchParams,
    getPreferences(),
  ]);
  const filters = parseTalentFilters(query),
    en = locale === "en",
    result = await searchTalent(filters),
    from = talentHref(filters);
  return (
    <main
      id="main"
      dir={en ? "ltr" : "rtl"}
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-8"
    >
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">
          {translateUi((en) ? "en" : "ar", "اكتشاف المواهب", "Discover talent")}
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          {translateUi((en) ? "en" : "ar", "مهارات طلابية تدعمها مشاركة موثّقة في الأندية والمجالس والفعاليات.", "Student skills, backed by approved activity in clubs, councils and events.")}
        </p>
      </header>
      <TalentSearch initial={filters} options={result.options} en={en} />
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {formatNumber(result.total,locale)}{" "}
        {translateUi((en) ? "en" : "ar", "نتيجة", "results")}
      </p>
      {result.items.length ? (
        <TalentCards items={result.items} locale={locale} returnTo={from} />
      ) : (
        <TalentEmpty en={en} filtered={result.available > 0} />
      )}
      {(filters.page > 0 || (filters.page + 1) * 24 < result.total) && (
        <Pagination aria-label={translateUi((en) ? "en" : "ar", "صفحات المواهب", "Talent pages")}>
          <PaginationContent>
            {filters.page > 0 && (
              <PaginationItem>
                <PaginationPrevious
                  href={talentHref({ ...filters, page: filters.page - 1 })}
                  text={translateUi((en) ? "en" : "ar", "السابق", "Previous")}
                  aria-label={translateUi((en) ? "en" : "ar", "الصفحة السابقة", "Previous page")}
                />
              </PaginationItem>
            )}
            {(filters.page + 1) * 24 < result.total && (
              <PaginationItem>
                <PaginationNext
                  href={talentHref({ ...filters, page: filters.page + 1 })}
                  text={translateUi((en) ? "en" : "ar", "التالي", "Next")}
                  aria-label={translateUi((en) ? "en" : "ar", "الصفحة التالية", "Next page")}
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </main>
  );
}
