import { redirect } from "next/navigation"

export default async function LegacyMyEventsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const pageValue = (await searchParams).page
  const page = Array.isArray(pageValue) ? pageValue[0] : pageValue
  const params = new URLSearchParams({ tab: "events" })
  if (page) params.set("page", page)
  redirect(`/activity?${params.toString()}`)
}
