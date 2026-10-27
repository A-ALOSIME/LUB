export type RequestsTab = "applications" | "renewals" | "organizations";

export function resolveRequestsTab(value: string | string[] | undefined): RequestsTab {
  if((Array.isArray(value)?value[0]:value)==="organizations")return "organizations";
  return (Array.isArray(value) ? value[0] : value) === "renewals" ? "renewals" : "applications";
}

export function requestsTabHref(tab: RequestsTab) {
  return `/applications?tab=${tab}`;
}

export function legacyRenewalsHref(page: string | string[] | undefined) {
  const params = new URLSearchParams({ tab: "renewals" });
  const firstPage = Array.isArray(page) ? page[0] : page;
  if (firstPage !== undefined) params.set("page", firstPage);
  return `/applications?${params.toString()}`;
}
