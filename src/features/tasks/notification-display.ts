import type { Locale } from "@/lib/preferences"
import { formatRiyadhDateTime } from "@/lib/datetime"

export function notificationDate(value: string, locale: Locale, now = Date.now()) {
  const date = new Date(value)
  const elapsed = now - date.getTime()
  const absolute = Math.abs(elapsed)
  const numberLocale = locale === "en" ? "en-US" : "ar-SA-u-nu-latn"
  if (Number.isFinite(elapsed) && absolute < 7 * 24 * 60 * 60 * 1000) {
    const [amount, unit] = absolute < 60_000
      ? [Math.round(elapsed / 1000), "second"]
      : absolute < 60 * 60 * 1000
        ? [Math.round(elapsed / 60_000), "minute"]
        : absolute < 24 * 60 * 60 * 1000
          ? [Math.round(elapsed / (60 * 60 * 1000)), "hour"]
          : [Math.round(elapsed / (24 * 60 * 60 * 1000)), "day"]
    return new Intl.RelativeTimeFormat(numberLocale, { numeric: "auto" }).format(-amount, unit as Intl.RelativeTimeFormatUnit)
  }
  return formatRiyadhDateTime(date, locale)
}

export function notificationHref(targetUrl: string | null | undefined) {
  if (!targetUrl || !targetUrl.startsWith("/") || targetUrl.startsWith("//")) return null
  const [path, rawQuery = ""] = targetUrl.split("?", 2)
  const source = new URLSearchParams(rawQuery)
  if (path === "/renewals" || path === "/applications" && source.get("tab") === "renewals") return "/applications?tab=renewals"
  if (path === "/applications") return "/applications"
  if (path === "/documents") return "/activity?tab=hours"
  if (path === "/hours") {
    const params = new URLSearchParams({ tab: "hours" })
    for (const key of ["page", "term"]) {
      const value = source.get(key)
      if (value) params.set(key, value)
    }
    return `/activity?${params.toString()}`
  }
  if (path === "/tasks") {
    const params = new URLSearchParams({ tab: "tasks" })
    if (source.get("mine") === "1" || source.get("taskFilter") === "mine") params.set("taskFilter", "mine")
    const page = source.get("page")
    if (page) params.set("page", page)
    return `/activity?${params.toString()}`
  }
  if (path === "/events" || path === "/events/mine") {
    const params = new URLSearchParams({ tab: "events" })
    const page = source.get("page")
    if (page) params.set("page", page)
    return `/activity?${params.toString()}`
  }
  if (path === "/notifications") return targetUrl
  if (/^\/(?:tasks|events)\/[0-9a-f-]{36}$/i.test(path)) return path
  if (/^\/activity\?tab=(?:tasks|events|hours)(?:&.*)?$/.test(targetUrl)) return targetUrl
  return null
}
