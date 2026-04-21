import { useState, useEffect, useCallback, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronRightIcon } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

type EmailStatus = "all" | "sent" | "failed" | "dlq" | "rate_limited" | "pending";
type TimeRange = "24h" | "7d" | "30d" | "all";

interface EmailLogRow {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  metadata: any;
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sent: { label: "Skickat", variant: "default" },
  failed: { label: "Misslyckat", variant: "destructive" },
  dlq: { label: "DLQ", variant: "destructive" },
  rate_limited: { label: "Rate-limited", variant: "secondary" },
  pending: { label: "Väntar", variant: "outline" },
  suppressed: { label: "Undertryckt", variant: "secondary" },
  bounced: { label: "Studsad", variant: "destructive" },
  complained: { label: "Klagomål", variant: "destructive" },
};

const STEP_LABELS: Record<string, string> = {
  client_invoke: "Klient → Edge Function",
  enqueue_pending: "Edge Function → Köad",
  enqueue_failed: "Köläggning misslyckades",
  provider_sent: "Provider → Skickat",
  provider_failed: "Provider misslyckades",
  moved_to_dlq: "Flyttat till DLQ",
};

const PAGE_SIZE = 25;

export default function EmailLogDashboard() {
  const [logs, setLogs] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<EmailStatus>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [trail, setTrail] = useState<Record<string, EmailLogRow[]>>({});

  const getTimeFilter = useCallback(() => {
    const now = new Date();
    switch (timeRange) {
      case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default: return null;
    }
  }, [timeRange]);

  const fetchStats = useCallback(async () => {
    const since = getTimeFilter();
    let query = supabase.from("email_send_log").select("status", { count: "exact" });
    if (since) query = query.gte("created_at", since);

    const { data } = await query;
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    setStats(counts);
  }, [getTimeFilter]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const since = getTimeFilter();
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, metadata, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (since) query = query.gte("created_at", since);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data, count } = await query;
    setLogs((data ?? []) as EmailLogRow[]);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [getTimeFilter, statusFilter, page]);

  const toggleExpand = useCallback(async (row: EmailLogRow) => {
    const next = new Set(expanded);
    if (next.has(row.id)) {
      next.delete(row.id);
      setExpanded(next);
      return;
    }
    next.add(row.id);
    setExpanded(next);

    // Fetch full trail for this message_id (all rows ordered by time)
    if (row.message_id && !trail[row.message_id]) {
      const { data } = await supabase
        .from("email_send_log")
        .select("id, message_id, template_name, recipient_email, status, error_message, metadata, created_at")
        .eq("message_id", row.message_id)
        .order("created_at", { ascending: true });
      setTrail((t) => ({ ...t, [row.message_id!]: (data ?? []) as EmailLogRow[] }));
    }
  }, [expanded, trail]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(0); }, [statusFilter, timeRange]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const statCards = [
    { label: "Skickade", value: stats.sent ?? 0, icon: CheckCircle, color: "text-green-500" },
    { label: "Misslyckade", value: (stats.failed ?? 0) + (stats.dlq ?? 0), icon: XCircle, color: "text-destructive" },
    { label: "Rate-limited", value: stats.rate_limited ?? 0, icon: AlertTriangle, color: "text-warning" },
    { label: "Väntar", value: stats.pending ?? 0, icon: Clock, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <Card className="glass-card border-t-2 border-t-primary/40">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-primary/10 shadow-sm">
                <Mail className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-heading text-base md:text-lg">E-postlogg</CardTitle>
                <CardDescription className="text-xs">Klicka på en rad för att se hela flödet (klient → kö → provider)</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { fetchLogs(); fetchStats(); }} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Uppdatera
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-4 md:px-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/50 bg-secondary/20 p-3 text-center">
                <s.icon className={`h-5 w-5 mx-auto ${s.color}`} />
                <p className="text-xl font-bold mt-1">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-1 rounded-lg bg-secondary/40 p-0.5">
              {(["24h", "7d", "30d", "all"] as TimeRange[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    timeRange === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "24h" ? "24h" : t === "7d" ? "7 dagar" : t === "30d" ? "30 dagar" : "Alla"}
                </button>
              ))}
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EmailStatus)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Alla statusar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla statusar</SelectItem>
                <SelectItem value="sent">Skickat</SelectItem>
                <SelectItem value="failed">Misslyckat</SelectItem>
                <SelectItem value="dlq">DLQ</SelectItem>
                <SelectItem value="rate_limited">Rate-limited</SelectItem>
                <SelectItem value="pending">Väntar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30">
                  <TableHead className="w-8" />
                  <TableHead className="text-xs">Tidpunkt</TableHead>
                  <TableHead className="text-xs">Mall</TableHead>
                  <TableHead className="text-xs">Mottagare</TableHead>
                  <TableHead className="text-xs">Steg</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Fel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                      Inga e-postloggar hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const badge = STATUS_BADGE[log.status] ?? { label: log.status, variant: "outline" as const };
                    const isOpen = expanded.has(log.id);
                    const step = log.metadata?.step as string | undefined;
                    const fullTrail = log.message_id ? trail[log.message_id] : null;
                    return (
                      <Fragment key={log.id}>
                        <TableRow
                          className="group cursor-pointer hover:bg-secondary/30"
                          onClick={() => toggleExpand(log)}
                        >
                          <TableCell className="py-2">
                            {isOpen
                              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "d MMM HH:mm:ss", { locale: sv })}
                          </TableCell>
                          <TableCell className="text-xs font-medium max-w-[140px] truncate">
                            {log.template_name}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">
                            {log.recipient_email}
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            {step ? (STEP_LABELS[step] ?? step) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={badge.variant} className="text-[10px]">
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-destructive/80 max-w-[250px] truncate">
                            {log.error_message || "—"}
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-secondary/10">
                            <TableCell colSpan={7} className="p-4">
                              <div className="space-y-4 text-xs">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  <DetailItem label="Message ID" value={log.message_id ?? "—"} mono />
                                  <DetailItem label="Idempotency-key" value={log.metadata?.idempotency_key ?? "—"} mono />
                                  <DetailItem label="Kö" value={log.metadata?.queue ?? "—"} />
                                  <DetailItem label="Försök" value={log.metadata?.attempt ?? "—"} />
                                  <DetailItem label="Provider-status" value={log.metadata?.provider_status ?? "—"} />
                                  <DetailItem label="Varaktighet (ms)" value={log.metadata?.duration_ms ?? "—"} />
                                  <DetailItem label="Avsändar-domän" value={log.metadata?.sender_domain ?? "—"} />
                                  <DetailItem label="Från" value={log.metadata?.from ?? "—"} />
                                  <DetailItem label="Ämne" value={log.metadata?.subject ?? "—"} />
                                </div>

                                {log.error_message && (
                                  <div>
                                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Fullt felmeddelande</p>
                                    <pre className="bg-destructive/10 text-destructive rounded-md p-2 text-[11px] overflow-auto whitespace-pre-wrap">
                                      {log.error_message}
                                    </pre>
                                  </div>
                                )}

                                {log.metadata?.provider_body && (
                                  <div>
                                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Provider-svar</p>
                                    <pre className="bg-muted rounded-md p-2 text-[11px] overflow-auto whitespace-pre-wrap max-h-48">
                                      {JSON.stringify(log.metadata.provider_body, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {log.metadata && (
                                  <details className="group">
                                    <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                                      Hela metadatan
                                    </summary>
                                    <pre className="mt-2 bg-muted rounded-md p-2 text-[11px] overflow-auto whitespace-pre-wrap max-h-64">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </details>
                                )}

                                {fullTrail && fullTrail.length > 1 && (
                                  <div>
                                    <p className="text-[11px] font-medium text-muted-foreground mb-2">
                                      Hela flödet för detta meddelande ({fullTrail.length} steg)
                                    </p>
                                    <div className="space-y-1.5">
                                      {fullTrail.map((t) => {
                                        const tBadge = STATUS_BADGE[t.status] ?? { label: t.status, variant: "outline" as const };
                                        const tStep = t.metadata?.step as string | undefined;
                                        return (
                                          <div key={t.id} className="flex items-center gap-2 text-[11px] bg-background/50 rounded px-2 py-1.5 border border-border/40">
                                            <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                                              {format(new Date(t.created_at), "HH:mm:ss.SSS", { locale: sv })}
                                            </span>
                                            <Badge variant={tBadge.variant} className="text-[9px] py-0 h-4">
                                              {tBadge.label}
                                            </Badge>
                                            <span className="text-muted-foreground">
                                              {tStep ? (STEP_LABELS[tStep] ?? tStep) : "—"}
                                            </span>
                                            {t.error_message && (
                                              <span className="text-destructive truncate flex-1">
                                                {t.error_message}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Sida {page + 1} av {totalPages} ({totalCount} rader)</span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailItem({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xs ${mono ? "font-mono" : ""} break-all`}>{String(value)}</p>
    </div>
  );
}
