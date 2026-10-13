"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireManagementUser } from "./access";
import { endOrganizationMembership, endOrganizationPermission, grantOrganizationPermission } from "./management-repository";
import type { WorkflowState } from "@/features/forms/actions";

const permission = z.enum([
  "ORG_PROFILE_MANAGE", "COMMITTEE_MANAGE", "COMMITTEE_PROFILE_MANAGE", "MEMBERS_VIEW", "MEMBERS_MANAGE",
  "FORMS_MANAGE", "REGISTRATION_ROUNDS_MANAGE", "APPLICATIONS_VIEW", "APPLICATIONS_REVIEW", "APPLICATIONS_BULK_ACTION",
  "TASKS_MANAGE", "TASK_TEMPLATES_MANAGE", "HOUR_RULES_MANAGE", "HOURS_APPROVE", "HOURS_MANUAL_ADD", "RENEWALS_MANAGE",
  "REPORTS_GENERATE", "EVENTS_MANAGE", "EVENT_ATTENDANCE_MANAGE", "EVENT_CONTRIBUTIONS_MANAGE",
]);
const id = (form: FormData, name: string) => z.uuid().parse(form.get(name));
const value = (form: FormData, name: string, max: number, min = 0) => z.string().trim().min(min).max(max).parse(form.get(name) ?? "");

export async function mutateOrganizationMembers(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  const user = await requireManagementUser();
  try {
    const operation = z.enum(["grant", "end-grant", "end-member"]).parse(form.get("operation"));
    const organizationId = id(form, "org");
    if (operation === "grant") {
      const memberId = id(form, "member");
      const capability = permission.parse(form.get("capability"));
      const committeeId = form.get("committee") ? id(form, "committee") : null;
      const endsValue = value(form, "ends", 40);
      const ends = endsValue ? z.iso.datetime({ offset: true }).parse(endsValue) : null;
      await grantOrganizationPermission(user.id, memberId, capability, committeeId, ends);
    } else if (operation === "end-grant") {
      if (form.get("confirm") !== "on") return { error: "أكّد إنهاء التفويض قبل المتابعة." };
      await endOrganizationPermission(user.id, id(form, "grant"));
    } else {
      if (form.get("confirm") !== "on") return { error: "أكّد إنهاء العضوية قبل المتابعة." };
      const reason = value(form, "reason", 500, 3);
      await endOrganizationMembership(user.id, id(form, "member"), reason);
    }
    revalidatePath(`/manage/organizations/${organizationId}`, "layout");
    revalidatePath("/me");
    return { success: "تم حفظ التغيير." };
  } catch {
    return { error: "تعذّر حفظ التغيير. راجع الصلاحية والنطاق والعضوية النشطة." };
  }
}
