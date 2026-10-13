import type { Application } from "./repository";

export type ApplicationStatusFilter = "all" | "review" | "accepted" | "rejected" | "withdrawn";

export type ApplicationStatusCounts = {
  all: number;
  review: number;
  accepted: number;
  rejected: number;
  withdrawn: number;
};

export const applicationStatusTabs: Array<{
  value: ApplicationStatusFilter;
  ar: string;
  en: string;
}> = [
  { value: "all", ar: "الكل", en: "All" },
  { value: "review", ar: "قيد المراجعة", en: "Under review" },
  { value: "accepted", ar: "مقبول", en: "Accepted" },
  { value: "rejected", ar: "مرفوض", en: "Rejected" },
  { value: "withdrawn", ar: "مسحوب", en: "Withdrawn" },
];

export function matchesApplicationStatus(status: string, filter: ApplicationStatusFilter) {
  if (filter === "all") return true;
  if (filter === "review") return status === "Submitted" || status === "Interview";
  return status === filterStatusCode[filter];
}

export function countApplicationStatuses(rows: ReadonlyArray<Pick<Application, "status_code">>): ApplicationStatusCounts {
  return {
    all: rows.length,
    review: rows.filter(row => matchesApplicationStatus(row.status_code, "review")).length,
    accepted: rows.filter(row => row.status_code === "Accepted").length,
    rejected: rows.filter(row => row.status_code === "Rejected").length,
    withdrawn: rows.filter(row => row.status_code === "Withdrawn").length,
  };
}

export function applicationStatusCode(filter: ApplicationStatusFilter) {
  return filter === "all" ? "" : filter === "review" ? "review" : filterStatusCode[filter];
}

const filterStatusCode = {
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} as const;
