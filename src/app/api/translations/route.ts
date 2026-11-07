export async function POST() {
  return Response.json({ error: "Automatic translation retired" }, {
    status: 410, headers: { "Cache-Control": "no-store" },
  });
}
