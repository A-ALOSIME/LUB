type IconName = "overview" | "organization" | "members" | "applications" | "events" | "hours" | "renewals" | "tasks" | "permissions" | "public" | "account" | "settings" | "terms" | "admins" | "logout" | "notifications";

const paths: Record<IconName, string> = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  organization: "M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M2 21h20M8 7h1m3 0h1M8 11h1m3 0h1M8 15h1m3 0h1M17 9h3v12",
  members: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  applications: "M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5h-2m2 0v5h5M7 13h10M7 17h7M7 9h2",
  events: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  hours: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  renewals: "M20 7v5h-5M4 17v-5h5m11-1a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3",
  tasks: "m9 11 3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  permissions: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zm-3-11 2 2 4-4",
  public: "M12 21s8-4.5 8-11a8 8 0 0 0-16 0c0 6.5 8 11 8 11zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  account: "M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-6v3m0 14v3m10-10h-3M5 12H2m17.07-7.07-2.12 2.12M7.05 16.95l-2.12 2.12m14.14 0-2.12-2.12M7.05 7.05 4.93 4.93",
  terms: "M4 5h16M4 10h16M4 15h10M4 20h10M18 14v7m-3.5-3.5h7",
  admins: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0M19 8h3m-1.5-1.5v3",
  logout: "M10 17l5-5-5-5m5 5H3m9-9h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6",
  notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0",
};

export function WorkspaceIcon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
