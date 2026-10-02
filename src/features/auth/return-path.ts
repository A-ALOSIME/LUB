// Only application and event registration paths may survive authentication. Never accept a host,
// scheme, encoded separator, backslash, query string or arbitrary internal route.
export function safeReturnPath(value: unknown, fallback = "/me") {
 return typeof value==="string" && /^\/organizations\/[a-z0-9-]{1,80}\/apply\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) || typeof value==="string" && /^\/events\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/register$/.test(value) ? value : fallback;
}
