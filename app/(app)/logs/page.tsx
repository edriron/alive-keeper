import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import type { Site, KeepAliveLog } from "@/types/database";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function statusColor(code: number | null) {
  if (!code) return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
  if (code >= 200 && code < 300)
    return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  if (code >= 300 && code < 400)
    return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  if (code >= 400 && code < 500)
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  return "bg-red-500/10 text-red-500 border-red-500/20";
}

function LogRow({ log }: { log: KeepAliveLog }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      {/* Status icon */}
      <div className="mt-0.5 shrink-0">
        {log.success ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <XCircle className="w-4 h-4 text-destructive" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        {/* Top row */}
        <div className="flex items-center gap-2 flex-wrap">
          <time className="text-xs text-muted-foreground font-mono">
            {formatDate(log.sent_at)}
          </time>

          {log.status_code && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusColor(log.status_code)}`}
            >
              {log.status_code}
            </span>
          )}

          {log.response_time_ms !== null && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {log.response_time_ms}ms
            </span>
          )}
        </div>

        {/* Error message */}
        {log.error_message && (
          <p className="text-xs text-destructive font-mono truncate">
            {log.error_message}
          </p>
        )}

        {/* Response body preview */}
        {Boolean(log.response_body) && !log.error_message && (
          <p className="text-[11px] text-muted-foreground font-mono truncate max-w-full">
            {JSON.stringify(log.response_body).slice(0, 120)}
          </p>
        )}
      </div>
    </div>
  );
}

interface SiteWithLogs extends Site {
  keep_alive_logs: KeepAliveLog[];
}

export default async function LogsPage() {
  const supabase = await createClient();

  // Fetch sites
  const { data: sites, error: sitesError } = await supabase
    .from("sites")
    .select("*")
    .order("name");

  if (sitesError) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Failed to load: {sitesError.message}
      </div>
    );
  }

  if (!sites?.length) {
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

      return { ...(site as Site), keep_alive_logs: (logs ?? []) as KeepAliveLog[] };
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sitesWithLogs.map((site) => {
          const logs = site.keep_alive_logs;
          const successCount = logs.filter((l) => l.success).length;
          const lastLog = logs[0];

          return (
            <Card key={site.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
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
                      <span className="text-[10px] text-muted-foreground">
                        {successCount}/{logs.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Last ping summary */}
                {lastLog && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Last ping:
                    </span>
                    {lastLog.success ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-destructive" />
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(lastLog.sent_at)}
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="pt-0 px-4 pb-4">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 opacity-30" />
                    <p className="text-xs">No pings yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50 -mx-1 px-1">
                    {logs.map((log) => (
                      <LogRow key={log.id} log={log} />
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
