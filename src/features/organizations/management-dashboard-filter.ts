export type ManagedOrganization = {
  id: string;
  nameAr: string;
  statusCode: string;
};

export function filterManagedOrganizations<T extends ManagedOrganization>(
  organizations: T[],
  query: string,
  status: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ar");
  return organizations.filter(organization => {
    const matchesQuery = !normalizedQuery || organization.nameAr.toLocaleLowerCase("ar").includes(normalizedQuery);
    const matchesStatus = status === "all" || organization.statusCode === status;
    return matchesQuery && matchesStatus;
  });
}
