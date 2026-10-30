// Liveness/readiness probe: the process is up. Deliberately does not touch
// Supabase, so a database blip doesn't restart pods (the page falls back to
// the bundled seed instead).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
