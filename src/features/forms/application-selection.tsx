"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { ManagementActionProvider } from "@/components/management-action-sheet";

import {
  RequestReviewTable,
  type ReviewDecision,
} from "./request-review-table";
import { mutateWorkflow } from "./actions";
import { ApplicationDetail } from "./application-detail";
import type { Application, Detail } from "./repository";
import type { Locale } from "@/lib/preferences";
export function ApplicationSelection({
  rows,
  locale = "ar",
  canBulk,
  selectedApplication,
  query,
}: {
  rows: Application[];
  locale?: Locale;
  canBulk: boolean;
  selectedApplication?: { detail: Detail; name: string };
  query: string;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams(),
    en = locale === "en",
    c = (ar: string, english: string) => (en ? english : ar);

  function openDetail(id: string) {
    const next = new URLSearchParams(query);
    next.set("application", id);
    router.push(`${pathname}?${next}`, { scroll: false });
  }
  function closeDetail(open: boolean) {
    if (open) return;
    const next = new URLSearchParams(search.toString());
    next.delete("application");
    router.replace(next.size ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });
  }
  async function decide(
    ids: string[],
    status: ReviewDecision,
    message: string,
  ) {
    const f = new FormData();
    f.set("operation", ids.length > 1 ? "bulk" : "decide");
    f.set("status", status);
    f.set("message", message);
    if (ids.length === 1) f.set("application", ids[0]);
    else ids.forEach((id) => f.append("selected", id));
    const result = await mutateWorkflow({}, f);
    if (result.success) router.refresh();
    return result;
  }
  return (
    <RequestReviewTable
      locale={locale}
      rows={rows.map((r) => ({
        id: r.id,
        name: r.name,
        subtitle: c("الجولة: ","Round: ")+r.title,
        committee: r.committee,
        status: r.status_code,
        createdAt: r.created_at,
        selectable:
          canBulk &&
          r.canBulk &&
          ["Submitted", "Interview"].includes(r.status_code),
        decisions:
          r.canReview && ["Submitted", "Interview"].includes(r.status_code)
            ? r.status_code === "Interview"
              ? ["Accepted", "Rejected"]
              : ["Accepted", "Rejected", "Interview"]
            : [],
      }))}
      onOpen={openDetail}
      onDecision={decide}
      bulkDecisions={canBulk ? ["Accepted", "Rejected", "Interview"] : []}
      showCommittee={rows.some((r) => !!r.committee)}
    >
      {(choose) =>
        selectedApplication && (
          <Sheet open onOpenChange={closeDetail}>
            <SheetContent
              side="left"
              showCloseButton={false}
              className="management-action-sheet gap-0 overflow-hidden p-0"
            >
              <SheetHeader className="management-action-header">
                <SheetTitle className="min-w-0 break-words">
                  {selectedApplication.name}
                </SheetTitle>
                <SheetClose
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute end-3 top-3"
                      aria-label={c("إغلاق", "Close")}
                      title={c("إغلاق", "Close")}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  }
                />
              </SheetHeader>
              <ManagementActionProvider
                locale={locale}
                close={() => closeDetail(false)}
              >
                <div
                  className="management-action-scroll space-y-5"
                  dir={en ? "ltr" : "rtl"}
                >
                  <ApplicationDetail
                    detail={selectedApplication.detail}
                    locale={locale}
                  />
                  {selectedApplication.detail.canReview &&
                    ["Submitted", "Interview"].includes(
                      selectedApplication.detail.status_code,
                    ) && (
                      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                        <Button
                          onClick={() =>
                            choose([selectedApplication.detail.id], "Accepted")
                          }
                        >
                          {c("قبول", "Accept")}
                        </Button>
                        <Button
                          variant="danger-outline"
                          onClick={() =>
                            choose([selectedApplication.detail.id], "Rejected")
                          }
                        >
                          {c("رفض", "Reject")}
                        </Button>
                        {selectedApplication.detail.status_code ===
                          "Submitted" && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              choose(
                                [selectedApplication.detail.id],
                                "Interview",
                              )
                            }
                          >
                            {c("جدولة مقابلة", "Schedule interview")}
                          </Button>
                        )}
                      </div>
                    )}
                </div>
              </ManagementActionProvider>
            </SheetContent>
          </Sheet>
        )
      }
    </RequestReviewTable>
  );
}
