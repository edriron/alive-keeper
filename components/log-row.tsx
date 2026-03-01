"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { KeepAliveLog } from "@/types/database";

export function statusColor(code: number | null) {
  if (!code) return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
  if (code >= 200 && code < 300)
    return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  if (code >= 300 && code < 400)
    return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  if (code >= 400 && code < 500)
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  return "bg-red-500/10 text-red-500 border-red-500/20";
}

interface Props {
  log: KeepAliveLog;
  siteName: string;
  siteUrl: string;
}

export function LogRow({ log, siteName, siteUrl }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Clickable row */}
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left flex items-start gap-3 py-2.5 rounded-md hover:bg-muted/40 transition-colors px-2 -mx-2 group"
      >
        <div className="mt-0.5 shrink-0">
          {log.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <XCircle className="w-4 h-4 text-destructive" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono">
              <LocalTime iso={log.sent_at} />
            </span>

            {log.status_code != null && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusColor(log.status_code)}`}
              >
                {log.status_code}
              </span>
            )}

            {log.response_time_ms != null && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                {log.response_time_ms}ms
              </span>
            )}
          </div>

          {log.error_message && (
            <p className="text-xs text-destructive font-mono line-clamp-1">
              {log.error_message}
            </p>
          )}

          {Boolean(log.response_body) && !log.error_message && (
            <p className="text-[11px] text-muted-foreground font-mono line-clamp-1">
              {JSON.stringify(log.response_body).slice(0, 100)}
            </p>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 mt-1 transition-colors">
          view
        </span>
      </button>

      {/* Full response dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-6">
              {log.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
              )}
              <span className="truncate">{siteName}</span>
            </DialogTitle>
            <DialogDescription className="font-mono text-xs truncate">
              {siteUrl}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap text-sm">
              {log.status_code != null && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${statusColor(log.status_code)}`}
                >
                  {log.status_code}
                </span>
              )}
              {log.response_time_ms != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {log.response_time_ms}ms
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto font-mono">
                <LocalTime iso={log.sent_at} />
              </span>
            </div>

            <Separator />

            {/* Error */}
            {log.error_message && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs font-semibold text-destructive mb-1">
                  Error
                </p>
                <p className="text-xs text-destructive font-mono break-all">
                  {log.error_message}
                </p>
              </div>
            )}

            {/* Response body */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Response Body
              </p>
              {log.response_body ? (
                <pre className="text-[11px] bg-muted/50 rounded-md p-3 overflow-auto max-h-60 font-mono leading-relaxed whitespace-pre-wrap break-all">
                  {JSON.stringify(log.response_body, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No response body
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
