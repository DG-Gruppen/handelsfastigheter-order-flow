import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Rss, Mail, Bot, Search, FileText, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import IntegrationDetailDialog from "./IntegrationDetailDialog";

interface IntegrationRow {
  id: string;
  slug: string;
  name: string;
  status: "ok" | "warning" | "error";
  last_sync_at: string | null;
  last_error: string | null;
  error_count: number;
  metadata: Record<string, unknown>;
  updated_at: string;
}

const SLUG_ICON: Record<string, React.ElementType> = {
  "cision-feed": Rss,
  "email-queue": Mail,
  "ai-chat": Bot,
  "content-index": Search,
  "document-extract": FileText,
  "heartpace": Users,
};

const STATUS_CONFIG = {
  ok: { label: "OK", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30" },
  warning: { label: "Varning", icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  error: { label: "Fel", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
};

export default function IntegrationsStatus() {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("integration_status")
      .select("*")
      .order("slug");
    if (!error && data) setRows(data as unknown as IntegrationRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  const testIntegration = async (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTesting(slug);
    try {
      const fnMap: Record<string, string> = {
        "cision-feed": "fetch-cision-feed",
        "content-index": "sync-content-index",
      };
      const fnName = fnMap[slug];
      if (!fnName) {
        toast.info("Denna integration kan inte testas manuellt");
        return;
      }
      const { error } = await supabase.functions.invoke(fnName);
      if (error) throw error;
      toast.success("Test klart – uppdaterar status…");
      setTimeout(fetchStatus, 2000);
    } catch (e: any) {
      toast.error(`Test misslyckades: ${e.message || "Okänt fel"}`);
    } finally {
      setTesting(null);
    }
  };

  const openDetail = (row: IntegrationRow) => {
    setSelectedIntegration(row);
    setDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Integrationer</h2>
          <p className="text-sm text-muted-foreground">Status för externa system och tjänster</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Uppdatera
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const Icon = SLUG_ICON[row.slug] || Search;
          const sc = STATUS_CONFIG[row.status] || STATUS_CONFIG.ok;
          const StatusIcon = sc.icon;

          return (
            <Card
              key={row.id}
              className={`border ${sc.border} cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]`}
              onClick={() => openDetail(row)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${sc.bg}`}>
                      <Icon className={`h-4.5 w-4.5 ${sc.color}`} />
                    </div>
                    <CardTitle className="text-sm font-semibold">{row.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className={`${sc.bg} ${sc.color} border-0 text-[11px]`}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {sc.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Senaste synk</span>
                  <span className="font-medium text-foreground">
                    {row.last_sync_at
                      ? formatDistanceToNow(new Date(row.last_sync_at), { addSuffix: true, locale: sv })
                      : "Aldrig"}
                  </span>
                </div>

                {row.error_count > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fel</span>
                    <span className="font-medium text-destructive">{row.error_count} st</span>
                  </div>
                )}

                {row.last_error && (
                  <p className="text-destructive/80 bg-destructive/5 rounded-md p-2 text-[11px] line-clamp-3 break-all">
                    {row.last_error}
                  </p>
                )}

                {["cision-feed", "content-index"].includes(row.slug) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-1 h-8 text-xs"
                    disabled={testing === row.slug}
                    onClick={(e) => testIntegration(row.slug, e)}
                  >
                    {testing === row.slug ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : null}
                    Testa anslutning
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {rows.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Inga integrationer hittades.
        </p>
      )}

      <IntegrationDetailDialog
        integration={selectedIntegration}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRefresh={fetchStatus}
        icon={SLUG_ICON[selectedIntegration?.slug || ""] || Search}
      />
    </div>
  );
}
