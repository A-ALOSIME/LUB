import { notFound, redirect } from "next/navigation";
import { z } from "zod";

export default async function OrganizationPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  redirect(`/manage/organizations/${id}/members?section=roles`);
}
