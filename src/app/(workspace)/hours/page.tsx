import { redirect } from "next/navigation"

export default async function LegacyHoursPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; term?: string | string[] }> }) {
  const query = await searchParams
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
  const params = new URLSearchParams({ tab: "hours" })
  const page = first(query.page)
  const term = first(query.term)
  if (page) params.set("page", page)
  if (term) params.set("term", term)
  redirect(`/activity?${params.toString()}`)
}
