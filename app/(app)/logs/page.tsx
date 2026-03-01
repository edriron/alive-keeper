import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Timer,
} from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { LogRow } from "@/components/log-row";
import type { Site, KeepAliveLog } from "@/types/database";

export const dynamic = "force-dynamic";

interface SiteWithLogs extends Site {
  keep_alive_logs: KeepAliveLog[];
}

export default async function LogsPage() {
  const supabase = await createClient();

  // Fetch sites + last run info concurrently
  const [sitesResult, lastEntryResult] = await Promise.all([
    supabase.from("sites").select("*").order("name"),
    supabase
      .from("keep_alive_logs")
      .select("sent_at")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (sitesResult.error) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Failed to load: {sitesResult.error.message}
      </div>
    );
  }

  const sites = sitesResult.data ?? [];

  // Derive last-run stats from a 60-second window around the most recent log
  let lastRun: { time: string; pinged: number; succeeded: number } | null =
    null;
  if (lastEntryResult.data) {
    const windowStart = new Date(
      new Date(lastEntryResult.data.sent_at).getTime() - 60_000
    ).toISOString();
    const { data: batchLogs } = await supabase
      .from("keep_alive_logs")
      .select("success")
      .gte("sent_at", windowStart);

    if (batchLogs) {
      lastRun = {
        time: lastEntryResult.data.sent_at,
        pinged: batchLogs.length,
        succeeded: batchLogs.filter((l) => l.success).length,
      };
    }
  }

  if (!sites.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Keep-alive ping history for each site.
          </p>
        </div>
        <div className="text-center py-16 text-muted-foreground text-sm">
          No sites configured yet. Add a site first.
        </div>
      </div>
    );
  }

  // Fetch last 10 logs per site (concurrent)
  const sitesWithLogs: SiteWithLogs[] = await Promise.all(
    sites.map(async (site) => {
      const { data: logs } = await supabase
        .from("keep_alive_logs")
        .select("*")
        .eq("site_id", site.id)
        .order("sent_at", { ascending: false })
        .limit(10);
      return {
        ...(site as Site),
        keep_alive_logs: (logs ?? []) as KeepAliveLog[],
      };
    })
  );

  const totalPings = sitesWithLogs.reduce(
    (acc, s) => acc + s.keep_alive_logs.length,
    0
  );
  const successRate =
    totalPings > 0
      ? Math.round(
          (sitesWithLogs
            .flatMap((s) => s.keep_alive_logs)
            .filter((l) => l.success).length /
            totalPings) *
            100
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last 10 keep-alive pings per site.
          </p>
        </div>
        {successRate !== null && (
          <div className="text-right">
            <p className="text-2xl font-semibold">{successRate}%</p>
            <p className="text-xs text-muted-foreground">success rate</p>
          </div>
        )}
      </div>

      {/* Last trigger banner */}
      {lastRun ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm">
          <Timer className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Last triggered:</span>
          <span className="font-mono text-xs">
            <LocalTime iso={lastRun.time} />
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-xs text-muted-foreground">
            {lastRun.pinged} site{lastRun.pinged !== 1 ? "s" : ""} pinged
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span
            className={`text-xs font-medium ${
              lastRun.succeeded === lastRun.pinged
                ? "text-emerald-500"
                : "text-destructive"
            }`}
          >
            {lastRun.succeeded}/{lastRun.pinged} succeeded
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground">
          <Timer className="w-4 h-4 shrink-0" />
          Keep-alive has not been triggered yet.
        </div>
      )}

      {/* Site cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sitesWithLogs.map((site) => {
          const logs = site.keep_alive_logs;
          const successCount = logs.filter((l) => l.success).length;
          const lastLog = logs[0];

          return (
            <Card key={site.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <CardTitle className="text-sm font-semibold truncate">
                      {site.name}
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                      {site.url}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {site.active ? (
                      <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    {logs.length > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {successCount}/{logs.length}
                      </span>
                    )}
                  </div>
                </div>

                {lastLog && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Last ping:
                    </span>
                    {lastLog.success ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-destructive" />
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      <LocalTime iso={lastLog.sent_at} />
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="pt-1 px-4 pb-3">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 opacity-30" />
                    <p className="text-xs">No pings yet</p>
                  </div>
                ) : (
                  <div className="space-y-0 divide-y divide-border/40">
                    {logs.map((log) => (
                      <LogRow
                        key={log.id}
                        log={log}
                        siteName={site.name}
                        siteUrl={site.url}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
