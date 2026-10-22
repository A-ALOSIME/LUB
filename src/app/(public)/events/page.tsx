import { redirect } from "next/navigation"

export default async function LegacyEventsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const value = (await searchParams).page
  const page = Array.isArray(value) ? value[0] : value
  const params = new URLSearchParams({ tab: "events" })
  if (page) params.set("page", page)
  redirect(`/activity?${params.toString()}`)
}
