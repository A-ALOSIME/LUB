import "server-only";
import { sql } from "drizzle-orm";
import { withUser } from "@/db/client";
import type { Answers, FormDefinition } from "@/features/forms/definition";

export type EventRegistrant = {
  isTest?:boolean;
  id: string;
  event_id: string;
  name: string;
  major: string;
  level: string;
  title: string;
  created_at: string;
  review_status_code: string;
  review_note: string;
  status_code: string;
  attendance: string;
  answers: Answers | null;
  definition: FormDefinition | null;
  canReview: boolean;
  canAttend: boolean;
  canRemove: boolean;
  attendanceOpen: boolean;
  history: Array<{ status_code: string; reason: string; created_at: string }>;
};
type EventRegistrantPage={
  items:EventRegistrant[];
  pending:number;
  accepted:number;
  rejected:number;
  canExport?:boolean;
  options:Array<{id:string;title:string;status_code?:string;starts_at?:string}>;
};
export async function eventRegistrants(
  user: string,
  org: string,
  event: string | null = null,
  q = "",
  status = "",
  page:number|null = 0,
  includeDetails=true,
  registration:string|null=null,
) {
  return withUser(user, async (tx) => {
    const [row] = await tx.execute<{data:EventRegistrantPage}>(sql`
      select lub.event_registrant_page(${org},${event},${q},${status},${page},${includeDetails},${registration}) as data
    `);
    return row.data;
  });
}
