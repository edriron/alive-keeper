import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Site } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const secret = process.env.KEEP_ALIVE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "KEEP_ALIVE_SECRET is not configured on the server" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Supabase (service role bypasses RLS) ─────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Fetch all active sites ───────────────────────────────────────────────────
  const { data: sites, error: fetchError } = await supabase
    .from("sites")
    .select("*")
    .eq("active", true);

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to fetch sites", detail: fetchError.message },
      { status: 500 }
    );
  }

  if (!sites?.length) {
    return NextResponse.json({
      ok: true,
      message: "No active sites to ping",
      pinged: 0,
      results: [],
    });
  }

  // ── Ping each site concurrently ──────────────────────────────────────────────
  const results = await Promise.allSettled(
    (sites as Site[]).map(async (site) => {
      const startTime = Date.now();

      // Build headers: start with configured headers, then add auth
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...site.headers,
      };

      if (site.secret) {
        headers["Authorization"] = `Bearer ${site.secret}`;
      }

      let statusCode: number | null = null;
      let responseBody: unknown = null;
      let success = false;
      let errorMessage: string | null = null;

      try {
        const response = await fetch(site.url, {
          method: site.method,
          headers,
          // 10-second timeout
          signal: AbortSignal.timeout(10_000),
        });

        statusCode = response.status;
        success = response.ok;

        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          try {
            responseBody = await response.json();
          } catch {
            responseBody = { raw: await response.text() };
          }
        } else {
          const text = await response.text();
          responseBody = { raw: text.slice(0, 500) };
        }
      } catch (err) {
        errorMessage =
          err instanceof Error ? err.message : "Unknown fetch error";
        success = false;
      }

      const responseTimeMs = Date.now() - startTime;

      // Save log to DB
      await supabase.from("keep_alive_logs").insert({
        site_id: site.id,
        status_code: statusCode,
        response_body: responseBody,
        response_time_ms: responseTimeMs,
        success,
        error_message: errorMessage,
      });

      return {
        site: site.name,
        url: site.url,
        success,
        statusCode,
        responseTimeMs,
        error: errorMessage,
      };
    })
  );

  const summary = results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      site: sites[i].name,
      url: sites[i].url,
      success: false,
      error: result.reason?.message ?? "Promise rejected",
    };
  });

  const successCount = summary.filter((r) => r.success).length;

  return NextResponse.json({
    ok: true,
    pinged: sites.length,
    succeeded: successCount,
    failed: sites.length - successCount,
    results: summary,
  });
}
