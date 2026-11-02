"use client";

import {createTranslator} from "@/lib/i18n";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useQueryActor} from "@/components/private-query-provider";
import {applicationDetailQuery} from "./application-queries";
import {Skeleton} from "@/components/ui/skeleton";
import {Alert,AlertDescription} from "@/components/ui/alert";
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
  organization,
  initialSelectedId,
}: {
  rows: Application[];
  locale?: Locale;
  canBulk: boolean;
  selectedApplication?: { detail: Detail; name: string };
  query?: string;
  organization: string;
  initialSelectedId?:string;
}) {
  const router=useRouter(),actor=useQueryActor(),client=useQueryClient(),en=locale==="en",c=createTranslator(locale);
  const [selected,setSelected]=useState<string|null>(initialSelectedId??selectedApplication?.detail.id??null);
  const query=applicationDetailQuery(actor,organization,selected);
  const result=useQuery({...query,enabled:!!selected,initialData:selectedApplication?.detail.id===selected?selectedApplication.detail:undefined});
  const detail=result.data;
  const name=rows.find(row=>row.id===selected)?.name??selectedApplication?.name??c("تفاصيل الطلب","Application details");
  function openDetail(id:string){setSelected(id);}
  function closeDetail(open:boolean){if(!open)setSelected(null);}
  function prefetch(id:string){void client.prefetchQuery(applicationDetailQuery(actor,organization,id));}
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
    if (result.success) {await client.invalidateQueries({queryKey:["application-detail",actor,organization]});router.refresh();}
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
      onPrefetch={prefetch}
      onDecision={decide}
      bulkDecisions={canBulk ? ["Accepted", "Rejected", "Interview"] : []}
      showCommittee={rows.some((r) => !!r.committee)}
    >
      {(choose) =>
        selected && (
          <Sheet open onOpenChange={closeDetail}>
            <SheetContent
              side="left"
              showCloseButton={false}
              className="management-action-sheet gap-0 overflow-hidden p-0"
            >
              <SheetHeader className="management-action-header">
                <SheetTitle className="min-w-0 break-words">
                  {name}
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
                  {detail?<ApplicationDetail detail={detail} locale={locale}/>:result.isError?<Alert><AlertDescription>{c("تعذّر عرض الطلب. حاول مجددًا.","Unable to load this application. Please try again.")}</AlertDescription></Alert>:<Skeleton className="h-40 w-full"/>}
                  {detail?.canReview &&
                    ["Submitted", "Interview"].includes(
                      detail.status_code,
                    ) && (
                      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                        <Button
                          onClick={() =>
                            choose([detail.id], "Accepted")
                          }
                        >
                          {c("قبول", "Accept")}
                        </Button>
                        <Button
                          variant="danger-outline"
                          onClick={() =>
                            choose([detail.id], "Rejected")
                          }
                        >
                          {c("رفض", "Reject")}
                        </Button>
                        {detail.status_code ===
                          "Submitted" && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              choose(
                                [detail.id],
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
