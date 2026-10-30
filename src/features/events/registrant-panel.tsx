
import {ContentText} from "@/components/content-text";
import {createTranslator} from "@/lib/i18n";
import Link from "next/link";
import { z } from "zod";
import { Search } from "lucide-react";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import { LiveFilterForm } from "@/components/live-filter-form";
import { ApplicationReviewStatusFilters } from "@/features/forms/application-review-status-filters";
import { eventRegistrants } from "./review-repository";
import { EventRegistrationReview } from "./registration-review";
import type { Locale } from "@/lib/preferences";

export async function EventRegistrantPanel({
  user,
  organization,
  event,
  search,
  locale,
}: {
  user: string;
  organization: string;
  event?: string;
  search: Record<string, string | undefined>;
  locale: Locale;
}) {
  const c = createTranslator((locale === "en") ? "en" : "ar"),
    q = (search.q ?? "").slice(0, 120),
    selectedEvent =
      event ??
      (z.uuid().safeParse(search.eventFilter).success
        ? search.eventFilter!
        : null),
    status = ["Pending", "Accepted", "Rejected"].includes(search.review ?? "")
      ? search.review!
      : "",
    page = Math.min(
      10000,
      Math.max(0, Math.floor(Number(search.registrationPage) || 0)),
    );
  const data = await eventRegistrants(
      user,
      organization,
      selectedEvent,
      q,
      status,
      page,
    ),
    section = event ? "attendees" : "registrants";
  const href = (review: string, nextPage = 0) =>
    `?${new URLSearchParams({ section, ...(q ? { q } : {}), ...(!event && selectedEvent ? { eventFilter: selectedEvent } : {}), ...(review ? { review } : {}), ...(nextPage ? { registrationPage: String(nextPage) } : {}) })}`;
  return (
    <section
      className="flex min-w-0 flex-col gap-4"
      aria-label={c("المسجلون في الفعاليات", "Event registrants")}
    >
      <LiveFilterForm className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="section" value={section} />
        <input type="hidden" name="review" value={status} />
        <InputGroup className="min-w-48 flex-1">
          <InputGroupAddon><Search/></InputGroupAddon>
          <InputGroupInput
            name="q"
            type="search"
            defaultValue={q}
            maxLength={120}
            placeholder={c("ابحث باسم الطالب", "Search student name")}
            aria-label={c("البحث باسم الطالب", "Search by student name")}
          />
        </InputGroup>
        {!event && (
          <NativeSelect
            name="eventFilter"
            defaultValue={selectedEvent ?? ""}
            aria-label={c("الفعالية", "Event")}
          >
            <option value="">{c("كل الفعاليات", "All events")}</option>
            {data.options.map((e) => (
              <option key={e.id} value={e.id}>
                <ContentText value={e.title}/>
              </option>
            ))}
          </NativeSelect>
        )}
      </LiveFilterForm>
      <ApplicationReviewStatusFilters
        value={status}
        locale={locale}
        ariaLabel={c("تصفية تسجيلات الفعاليات", "Filter event registrations")}
        options={[
          {
            value: "",
            label: c("الكل", "All"),
            count: data.pending + data.accepted + data.rejected,
            href: href(""),
          },
          {
            value: "Pending",
            label: c("بانتظار", "Pending"),
            count: data.pending,
            href: href("Pending"),
          },
          {
            value: "Accepted",
            label: c("مقبول", "Accepted"),
            count: data.accepted,
            href: href("Accepted"),
          },
          {
            value: "Rejected",
            label: c("مرفوض", "Rejected"),
            count: data.rejected,
            href: href("Rejected"),
          },
        ]}
      />
      <EventRegistrationReview items={data.items} locale={locale} />
      {(page > 0 || data.items.length > 25) && (
        <nav className="flex gap-4">
          {page > 0 && (
            <Link href={href(status, page - 1)}>{c("السابق", "Previous")}</Link>
          )}
          {data.items.length > 25 && (
            <Link href={href(status, page + 1)}>{c("التالي", "Next")}</Link>
          )}
        </nav>
      )}
    </section>
  );
}
