import { isAbsolute, relative, resolve, sep } from "node:path";

export const BASELINE_COMMIT = "082c0cd930af71b3735944b546130e72ef2e579e";
export const SANDBOX = { container: "lub-schema-simplification-db", port: "55418", database: "lub_simplification" } as const;

export function requireSandboxUrl(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("An isolated PostgreSQL URL is required."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.port !== SANDBOX.port || url.pathname !== `/${SANDBOX.database}` || url.search || url.hash || !url.username || !url.password) {
    throw new Error("Refusing a database outside the schema-simplification sandbox.");
  }
  return url;
}

export function requireOutsideRepository(path: string, repository: string) {
  const target = resolve(path), child = relative(resolve(repository), target);
  if (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child)) throw new Error("Private backup files must stay outside the repository.");
  return target;
}
