"use server";

import { revalidatePath, updateTag } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withUser } from "@/db/client";
import { requireUser } from "@/features/auth/session";
import { studentOperationError } from "@/features/auth/authorization";
import { normalizeDigits } from "@/lib/validation";
import { normalizeOrganizationContact, organizationContactAddableKinds } from "@/features/organizations/contact-channels";
import type { WorkflowState } from "@/features/forms/actions";

const id = (form: FormData, key: string) => z.uuid().parse(form.get(key));
const optionalId = (form: FormData, key: string) => form.get(key) ? id(form, key) : null;
const text = (form: FormData, key: string, max: number, min = 0) => z.string().trim().min(min).max(max).parse(form.get(key) ?? "");
const checked = (form: FormData, key: string) => form.get(key) === "true";
const linkKind = z.enum([...organizationContactAddableKinds, "GitHub","Behance"]);

function contactValue(kind: z.infer<typeof linkKind>, input: string) {
  const normalized = normalizeOrganizationContact({ kind, value: kind === "Phone" ? normalizeDigits(input) : input });
  if (!normalized) throw new Error("Invalid talent contact channel");
  return normalized.value;
}

export async function mutateTalent(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  const user = await requireUser();
  const adminError = await studentOperationError(user.id);
  if (adminError) return { error: adminError };

  try {
    const operation = z.enum(["profile", "link", "update-link", "remove-link", "skill", "remove-skill", "project"]).parse(form.get("operation"));
    await withUser(user.id, async (tx) => {
      switch (operation) {
        case "profile": {
          await tx.execute(sql`select lub.save_talent_settings(${text(form, "bio", 1000)},${checked(form, "enabled")},${checked(form,"indexable")})`);

          const linkIds = z.array(z.uuid()).max(10).parse(form.getAll("linkId"));
          for (const linkId of linkIds) {
            const fields = `link_${linkId}_`;
            const kind = linkKind.parse(form.get(`${fields}kind`));
            const label = text(form, `${fields}label`, 80, 1);
            const input = text(form, `${fields}value`, 2048, 1);
            const value = contactValue(kind, input);
            await tx.execute(sql`select lub.save_talent_link(${linkId},${kind},${label},${value},${checked(form, `${fields}visible`)})`);
          }

          const skillCount = z.coerce.number().int().min(0).max(30).parse(form.get("skillCount") ?? "0");
          for (let index = 0; index < skillCount; index++) {
            await tx.execute(sql`select lub.save_talent_skill(${text(form, `skill_${index}_name`, 80, 2)},${checked(form, `skill_${index}_visible`)})`);
          }

          const projectCount = z.coerce.number().int().min(0).max(25).parse(form.get("projectCount") ?? "0");
          for (let index = 0; index < projectCount; index++) {
            const fields = `project_${index}_`;
            await tx.execute(sql`select lub.save_talent_project(
              ${id(form, `${fields}id`)},
              ${optionalId(form, `${fields}participant`)},
              ${optionalId(form, `${fields}contribution`)},
              ${text(form, `${fields}title`, 120, 2)},
              ${text(form, `${fields}description`, 1000)},
              ${checked(form, `${fields}featured`)}
            )`);
          }
          break;
        }
        case "link": {
          const kind = linkKind.parse(form.get("kind"));
          const input = text(form, "value", 2048, 1);
          const value = contactValue(kind, input);
          await tx.execute(sql`select lub.save_talent_link(null,${kind},${kind},${value},${checked(form, "visible")})`);
          break;
        }
        case "update-link": {
          const link = id(form, "link");
          const kind = linkKind.parse(form.get("kind"));
          const label = text(form, "label", 80, 1);
          const input = text(form, "value", 2048, 1);
          const value = contactValue(kind, input);
          await tx.execute(sql`select lub.save_talent_link(${link},${kind},${label},${value},${checked(form, "visible")})`);
          break;
        }
        case "remove-link":
          await tx.execute(sql`select lub.remove_talent_link(${id(form, "link")})`);
          break;
        case "skill":
          await tx.execute(sql`select lub.save_talent_skill(${text(form, "name", 80, 2)},${checked(form, "visible")})`);
          break;
        case "remove-skill":
          await tx.execute(sql`select lub.remove_talent_skill(${text(form, "name", 80, 2)})`);
          break;
        case "project": {
          const participant = optionalId(form, "participant");
          const contribution = optionalId(form, "contribution");
          await tx.execute(sql`select lub.save_talent_project(
            ${optionalId(form, "project")},${participant},${contribution},
            ${text(form, "title", 120, 2)},${text(form, "description", 1000)},${checked(form, "featured")}
          )`);
          break;
        }
      }
    });
  } catch {
    return { error: "تعذّر حفظ الملف المهاري. راجع الحقول؛ الروابط تبدأ بـ HTTPS، والإنجاز يحتاج نشاطًا معتمدًا تملكه داخل LUB." };
  }

  updateTag("public-talent");
  revalidatePath("/talent", "layout");
  revalidatePath("/account/talent");
  revalidatePath("/me");
  return { success: "تم حفظ الملف المهاري والخصوصية." };
}
