import { redirect } from "next/navigation"

export default async function LegacyDocumentsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const pageValue = (await searchParams).page
  const page = Array.isArray(pageValue) ? pageValue[0] : pageValue
  const params = new URLSearchParams({ tab: "hours", documents: "1" })
  if (page) params.set("docPage", page)
  redirect(`/activity?${params.toString()}`)
}
