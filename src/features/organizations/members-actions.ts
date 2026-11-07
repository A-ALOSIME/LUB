"use server";

import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireManagementUser } from "./access";
import { endOrganizationMembership } from "./management-repository";
import type { WorkflowState } from "@/features/forms/actions";

const id = (form: FormData, name: string) => z.uuid().parse(form.get(name));
const value = (form: FormData, name: string, max: number, min = 0) => z.string().trim().min(min).max(max).parse(form.get(name) ?? "");

export async function mutateOrganizationMembers(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  const user = await requireManagementUser();
  try {
    const operation = z.enum(["set-role", "end-member", "move-member"]).parse(form.get("operation"));
    const organizationId = id(form, "org");
    if(operation==="set-role"){
      if(form.get("confirm")!=="on")throw new Error("Confirmation required");
      const role=z.enum(["Member","OD","CL","CD","HRL","HRD"]).parse(form.get("role"));
      await withUser(user.id,tx=>tx.execute(sql`select lub.change_member_role(${id(form,"member")},${role},${form.get("committee")?id(form,"committee"):null})`));
    } else if(operation==="move-member"){
      await withUser(user.id,tx=>tx.execute(sql`select lub.move_member_committee(${id(form,"member")},${form.get("committee")?id(form,"committee"):null},${form.get("confirmRoleChange")==="on"})`));
    } else {
      if (form.get("confirm") !== "on") return { error: "أكّد إنهاء العضوية قبل المتابعة." };
      const reason = value(form, "reason", 500, 3);
      await endOrganizationMembership(user.id, id(form, "member"), reason);
    }
    revalidatePath(`/manage/organizations/${organizationId}`, "layout");
    revalidatePath("/me");
    updateTag("public-organizations");
    updateTag("public-talent");
    return { success: "تم حفظ التغيير." };
  } catch {
    return { error: "تعذّر حفظ التغيير. راجع الصلاحية والنطاق والعضوية النشطة." };
  }
}
