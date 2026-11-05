"use client";
import {useQuery} from "@tanstack/react-query";
import {useQueryActor} from "@/components/private-query-provider";
import {privateJson} from "@/lib/private-query";

import {ContentText} from "@/components/content-text";

import {createTranslator} from "@/lib/i18n";
import {NumberText} from "@/components/number-text";
import { useState } from "react";
import { Check, Eye, SlidersHorizontal, X, ChevronDown, Undo2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {HourAdjustment} from "./hour-adjustment";
import {Collapsible,CollapsibleTrigger,CollapsibleContent} from "@/components/ui/collapsible";
import {Button} from "@/components/ui/button";
import {Separator} from "@/components/ui/separator";
import {DataTable} from "@/components/data-table";
import { OrganizationStatusBadge } from "@/features/organizations/organization-status-badge";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription} from "@/components/ui/alert-dialog";
import {ManagementActionProvider} from "@/components/management-action-sheet";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { RowAction } from "@/components/row-action";
import { HoursForm } from "./form";
import type { HourRecord } from "./repository";
import type { Locale } from "@/lib/preferences";
import { formatRiyadhDate, formatRiyadhDateTime } from "@/lib/datetime";
import { academicLevel, academicTerm, formatHours } from "@/lib/display";
import { FormField } from "@/components/form-field";

const labels: Record<string, [string, string]> = {
  Pending: ["بانتظار الاعتماد", "Pending approval"],
  Approved: ["معتمدة", "Approved"],
  Rejected: ["مرفوضة", "Rejected"],
  Withdrawn: ["مسحوب", "Withdrawn"],
  Voided: ["مبطلة", "Voided"],
  MANUAL: ["إضافة يدوية", "Manual entry"],
  SELF_REPORTED: ["طلب ذاتي", "Self-reported"],
  TASK: ["مهمة", "Task"],
  EVENT: ["فعالية", "Event"],
};
export function HourStatus({
  status,
  locale = "ar",
}: {
  status: string;
  locale?: Locale;
}) {
  return (
    <OrganizationStatusBadge
      status={
        status === "Approved"
          ? "accepted"
          : status === "Pending"
            ? "review"
            : status === "Rejected"
              ? "rejected"
              : "inactive"
      }
    >
      {labels[status]?.[locale === "en" ? 1 : 0] ?? status}
    </OrganizationStatusBadge>
  );
}
function RecordActions({
  record:row,
  locale,initialDetails=false,hideActions=false,onClose,personal=false,
}: {
  record: HourRecord;
  locale: Locale;initialDetails?:boolean;hideActions?:boolean;onClose?:()=>void;personal?:boolean;
}) {
  const [action, setAction] = useState<
      "adjust" | "details" | "approve" | "reject" | "withdraw" | null
    >(initialDetails?"details":null),
    en = locale === "en",
    c = createTranslator((en) ? "en" : "ar");
  const actor=useQueryActor(),details=useQuery({queryKey:["hour-record",actor,row.organization_id,row.id,row.hours,row.status_code],queryFn:({signal})=>privateJson<HourRecord>(`/api/hours/${row.id}`,signal),enabled:action==="details"});
  const record=details.data??row;
  const editable =
    !personal && record.canReview && ["Pending", "Approved"].includes(record.status_code);
  return (
    <>
      {!hideActions&&<div className="hours-row-actions">
        {!personal&&<>        <RowAction
          label={c("تعديل الساعات", "Adjust hours")}
          hint={
            !editable
              ? c(
                  "يتطلب صلاحية تعديل الساعات وسجلًا قابلًا للتعديل.",
                  "Requires hours permission and an editable record.",
                )
              : undefined
          }
          disabled={!editable}
          onClick={() => setAction("adjust")}
        >
          <SlidersHorizontal />
        </RowAction></>}
        <RowAction
          label={c("عرض التفاصيل", "View details")}
          onClick={() => setAction("details")}
        >
          <Eye />
        </RowAction>
        {!personal&&(record.canReview && record.status_code === "Pending" ? (
          <>
            <RowAction
              label={c("اعتماد", "Approve")}
              onClick={() => setAction("approve")}
            >
              <Check />
            </RowAction>
            <RowAction
              label={c("رفض", "Reject")}
              danger
              onClick={() => setAction("reject")}
            >
              <X />
            </RowAction>
          </>
        ) : (
          <>
            <RowAction label={c("اعتماد","Approve")} disabled><Check/></RowAction>
            <RowAction label={c("رفض","Reject")} danger disabled><X/></RowAction>
          </>
        ))}
        {personal&&record.source_code==="SELF_REPORTED"&&<RowAction label={c("سحب طلب الساعات","Withdraw hours request")} danger disabled={!record.canWithdraw} hint={c("يمكن سحب طلبك الذاتي وهو بانتظار الاعتماد فقط","Only your pending self-reported request can be withdrawn")} onClick={()=>setAction("withdraw")}><Undo2/></RowAction>}
      </div>}
      <AlertDialog open={action==="withdraw"} onOpenChange={open=>{if(!open)setAction(null);}}><AlertDialogContent dir={en?"ltr":"rtl"}><AlertDialogHeader><AlertDialogTitle>{c("سحب طلب الساعات؟","Withdraw hours request?")}</AlertDialogTitle><AlertDialogDescription>{c("سيصبح الطلب مسحوبًا ويبقى في سجلك، ولن تُحتسب ساعاته.","The request will remain in your history as withdrawn and its hours will not count.")}</AlertDialogDescription></AlertDialogHeader><ManagementActionProvider locale={locale} close={()=>setAction(null)}><HoursForm operation="withdraw-self" fields={{record:record.id}} locale={locale} label={c("سحب الطلب","Withdraw request")}/></ManagementActionProvider></AlertDialogContent></AlertDialog>
      {action === "adjust" && (
        <ManagementActionSheet
          label=""
          title={c("تعديل الساعات", "Adjust hours")}
          locale={locale}
          open
          onOpenChange={(open) => {
            if (!open) setAction(null);onClose?.();
          }}
          hideTrigger
        >
          <HourAdjustment
            record={record}
            locale={locale}
            onSuccess={() => setAction(null)}
          />
        </ManagementActionSheet>
      )}
      {action === "details" && (
        <ManagementActionSheet
          label=""
          title={c("تفاصيل سجل الساعات", "Hours record details")}
          locale={locale}
          open
          onOpenChange={(open) => {
            if (!open) setAction(null);onClose?.();
          }}
          hideTrigger
          presentation="sheet"
        >
          <div className="hour-record-details">{details.isError&&<p role="alert" className="text-sm text-muted-foreground">{c("تعذّر تحميل سجل القرارات. أغلق التفاصيل وحاول مجددًا.","Could not load the decision history. Close details and try again.")}</p>}
            <HourStatus status={record.status_code} locale={locale}/>
            <dl className="hour-detail-fields">
              <div>
                <dt>{c("الجهة", "Organization")}</dt>
                <dd><ContentText value={record.org_name}/></dd>
              </div>
              <div>
                <dt>{c("السبب", "Reason")}</dt>
                <dd><ContentText value={record.description}/></dd>
              </div>
              <div>
                <dt>{c("الساعات", "Hours")}</dt>
                <dd>{formatHours(record.hours, locale)}</dd>
              </div>
              <div>
                <dt>{c("التاريخ", "Date")}</dt>
                <dd>{formatRiyadhDate(record.activity_date, locale, true)}</dd>
              </div>

            </dl>
            {record.decisions.length > 0 && (
              <><Separator/><Collapsible className="hour-decision-details">
                <CollapsibleTrigger render={<Button type="button" variant="ghost" className="hour-detail-toggle"/>}>
                  <ChevronDown aria-hidden="true" />
                  {c("تفاصيل القرار", "Decision details")}
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-3 pt-3">
                  {record.decisions.map((decision, index) => (
                    <div key={index}>
                      <HourStatus
                        status={decision.status_code}
                        locale={locale}
                      />
                      <p className="text-sm text-muted-foreground">
                        {formatRiyadhDateTime(
                          decision.created_at,
                          locale,
                          true,
                        )}
                      </p>
                      {decision.note && (
                        <p className="whitespace-pre-wrap">{decision.note}</p>
                      )}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible></>
            )}
            <Separator/><Collapsible>
              <CollapsibleTrigger render={<Button type="button" variant="ghost" className="hour-detail-toggle"/>}><ChevronDown/>
                {c("سجل التعديلات", "Adjustment history")}
              </CollapsibleTrigger><CollapsibleContent className="pt-3">
              {record.adjustments?.length ? (
                <ol className="flex flex-col gap-4">
                  {record.adjustments.map((item, index) => {
                    const delta =
                      Number(item.after_hours) - Number(item.before_hours);
                    return (
                      <li key={index} className="border-s border-border ps-3">
                        <p>
                          {c("تعديل", "Adjustment")}{" "}
                          <bdi dir="ltr">
                            {delta > 0 ? "+" : "−"}
                            <NumberText value={Math.abs(delta)}/>{" "}
                            {en
                              ? "hours"
                              : Math.abs(delta) >= 3 && Math.abs(delta) <= 10
                                ? "ساعات"
                                : "ساعة"}
                          </bdi>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatRiyadhDateTime(item.created_at, locale, true)}{" "}
                          · {c("بواسطة", "by")} {item.actor_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {c(`من ${item.before_hours} إلى ${item.after_hours} ساعة`,`From ${item.before_hours} to ${item.after_hours} hours`)}
                        </p>
                        {item.note && (
                          <p className="whitespace-pre-wrap text-sm">
                            {item.note}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {c("لم تُعدّل ساعات هذا السجل.", "No adjustments yet.")}
                </p>
              )}
            </CollapsibleContent></Collapsible>
          </div>
        </ManagementActionSheet>
      )}
      {(action === "approve" || action === "reject") && (
        <ManagementActionSheet
          label=""
          title={
            action === "reject"
              ? c(
                  `رفض ساعات ${record.owner ?? record.org_name}؟`,
                  `Reject hours for ${record.owner ?? record.org_name}?`,
                )
              : c(
                  `اعتماد ساعات ${record.owner ?? record.org_name}؟`,
                  `Approve hours for ${record.owner ?? record.org_name}?`,
                )
          }
          locale={locale}
          open
          onOpenChange={(open) => {
            if (!open) setAction(null);onClose?.();
          }}
          hideTrigger
        >

          <HoursForm
            operation="review"
            fields={{
              record: record.id,
              status: action === "reject" ? "Rejected" : "Approved",
              ...(action === "approve" ? { note: "" } : {}),
            }}
            label={
              action === "reject"
                ? c("تأكيد الرفض", "Confirm rejection")
                : c("اعتماد الساعات", "Approve hours")
            }
            locale={locale}
            buttonClassName={action === "reject" ? "button-danger" : undefined}
            onSuccess={() => setAction(null)}
          >
          <p className="mb-4 text-sm text-muted-foreground">
            {action === "reject"
              ? c(
                  "سيصبح السجل مرفوضًا ولن يُحتسب في الساعات المعتمدة.",
                  "The record will be rejected and excluded from approved hours.",
                )
              : c(
                  "ستُضاف ساعات السجل إلى الرصيد المعتمد.",
                  "The record will count toward approved hours.",
                )}
          </p>
            {action === "reject" && <FormField  id={`hour-rejection-${record.id}`} label={<>{c("سبب الرفض", "Rejection reason")}</>}><Textarea id={`hour-rejection-${record.id}`} name="note" required maxLength={3000} rows={3}/></FormField>}
          </HoursForm>
        </ManagementActionSheet>
      )}
    </>
  );
}
export function HoursRecordTable({
  items,
  locale = "ar",
  personal = false,pagination,
}: {
  items: HourRecord[];
  locale?: Locale;
  personal?: boolean;pagination?:import("@/components/data-table").DataTablePagination;
}) {
  const [selected,setSelected]=useState<HourRecord|null>(null);
  const en = locale === "en",
    c = createTranslator((en) ? "en" : "ar"),
    records = items;
  const source = (record: HourRecord) =>
    `${labels[record.source_code]?.[en ? 1 : 0] ?? record.source_code}${!personal && record.context?.added_by ? ` ${c("بواسطة", "by")} ${record.context.added_by}` : ""}`;
  const identity = (record: HourRecord) => (
    <div className="flex min-w-0 items-center gap-2.5">

      <div className="min-w-0">
        <p className="font-medium break-words">
          {personal ? record.org_name : (record.owner ?? c("عضو", "Member"))}
        </p>
        <p className="text-xs text-muted-foreground break-words">
          {personal
            ? academicTerm(record.term_name, locale)
            : [
                record.context?.major,
                academicLevel(record.context?.level, locale),
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </div>
    </div>
  );
  return (
    <section
      className="hours-ledger min-w-0"
      aria-label={c("سجلات الساعات", "Hours records")}
    >
      <DataTable pagination={pagination} items={records} locale={locale} tableKey="hours" label={c("تفاصيل سجل الساعات","Hours record details")} onOpen={setSelected} columns={[
        {id:"name",label:personal?c("الجهة","Organization"):c("العضو","Member"),render:identity},
        ...(!personal?[
          {id:"committee",label:c("اللجنة","Committee"),className:"w-32",render:(record:HourRecord)=>record.context?.committee_name??c("بدون لجنة","No committee")},
          {id:"description",label:c("السبب","Reason"),className:"w-48",render:(record:HourRecord)=><><p><ContentText value={record.description}/></p><p className="text-sm text-muted-foreground">{source(record)}</p></>}
        ]:[]),
        {id:"hours",label:c("الساعات","Hours"),className:"w-28",render:record=>formatHours(record.hours,locale)},
        {id:"date",label:personal?c("التاريخ","Date"):c("التاريخ والفصل","Date and term"),className:"w-40",render:record=><><time>{formatRiyadhDate(record.activity_date,locale)}</time>{!personal&&<p className="text-sm text-muted-foreground">{academicTerm(record.term_name,locale)}</p>}</>},
        ...(personal?[{id:"source",label:c("المصدر","Source"),className:"w-40",render:source}]:[]),
        {id:"status",label:c("الحالة","Status"),className:"w-36",render:record=><HourStatus status={record.status_code} locale={locale}/>},
        {id:"actions",label:c("الإجراءات","Actions"),className:"w-40",render:record=><RecordActions record={record} personal={personal} locale={locale}/>}
      ]}/>
      {selected&&<RecordActions key={selected.id} record={selected} personal={personal} locale={locale} initialDetails hideActions onClose={()=>setSelected(null)}/>}
    </section>
  );
}
