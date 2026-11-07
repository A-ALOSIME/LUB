import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireManagementUser } from "@/features/organizations/access";
import { hoursWorkspace } from "@/features/hours/repository";

export default async function LegacyManageHoursPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireManagementUser();
  if (!await hoursWorkspace(user.id, id)) notFound();
  redirect(`/manage/organizations/${id}/tasks?section=hours`);
}
