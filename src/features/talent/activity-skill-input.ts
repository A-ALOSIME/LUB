import { z } from "zod";
const skillKeys = z
  .array(z.string().min(1).max(120))
  .max(30)
  .refine((keys) => new Set(keys).size === keys.length);
// Absence keeps old forms/backward-compatible API calls from clearing existing tags.
export function activitySkillKeys(form: FormData): string[] | null {
  return form.has("skills-present")
    ? skillKeys.parse(form.getAll("skill"))
    : null;
}
