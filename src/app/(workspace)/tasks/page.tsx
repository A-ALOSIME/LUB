import { redirect } from "next/navigation"

export default async function LegacyTasksPage({ searchParams }: { searchParams: Promise<{ page?: string; mine?: string }> }) {
  const query = await searchParams
  const params = new URLSearchParams({ tab: "tasks" })
  if (query.mine === "1") params.set("taskFilter", "mine")
  if (query.page) params.set("page", query.page)
  redirect(`/activity?${params.toString()}`)
}
