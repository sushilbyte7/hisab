import { toISODate } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";
import { getExportData } from "@/services/profile";

// NOTE: no `export const dynamic = "force-dynamic"` here — that segment
// config is incompatible with `cacheComponents` (Next 16). This handler
// is dynamic anyway because it reads cookies() via the server client.

/**
 * GET /api/export — download the signed-in user's Hisab data as JSON.
 * Authenticated via the server Supabase client; unauthenticated
 * requests get a 401 instead of a file.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not signed in." }, { status: 401 });
    }

    const data = await getExportData(user.id);
    const filename = `hisab-export-${toISODate(new Date())}.json`;

    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Export failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
