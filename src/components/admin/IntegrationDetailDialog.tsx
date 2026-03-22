import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Key, Eye, EyeOff, Save, Clock, Hash, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { sv } from "date-fns/locale";

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

interface Props {
  integration: IntegrationRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  icon: React.ElementType;
}

const STATUS_CONFIG = {
  ok: { label: "Aktiv", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30" },
  warning: { label: "Varning", icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  error: { label: "Fel", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
};

// Map slug to secret name
const SLUG_SECRET_MAP: Record<string, string> = {
  "cision-feed": "CISION_FEED_URL",
  "email-queue": "RESEND_API_KEY",
  "ai-chat": "LOVABLE_API_KEY",
  "content-index": "FIRECRAWL_API_KEY",
  "document-extract": "FIRECRAWL_API_KEY",
  "heartpace": "HEARTPACE_API_KEY",
};

const SLUG_DESCRIPTION: Record<string, string> = {
  "cision-feed": "Hämtar nyheter från Cision RSS-flöde och publicerar dem automatiskt i intranätets nyhetsflöde.",
  "email-queue": "Hanterar e-postutskick via Resend. Köar och skickar transaktionella meddelanden som aviseringar, orderbekräftelser etc.",
  "ai-chat": "AI-assistenten som hjälper medarbetare med frågor baserat på intranätets innehåll. Använder Lovable AI.",
  "content-index": "Indexerar och synkroniserar innehåll för AI-sökning. Inkluderar webbscraping via Firecrawl.",
  "document-extract": "Extraherar text från uppladdade dokument (PDF, Word, Excel) för sökindexering.",
  "heartpace": "HR-system för synkronisering av medarbetardata och organisationsstruktur. Inväntar API-åtkomst.",
};

export default function IntegrationDetailDialog({ integration, open, onOpenChange, onRefresh, icon: Icon }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  if (!integration) return null;

  const sc = STATUS_CONFIG[integration.status] || STATUS_CONFIG.ok;
  const StatusIcon = sc.icon;
  const secretName = SLUG_SECRET_MAP[integration.slug];
  const description = SLUG_DESCRIPTION[integration.slug] || "Ingen beskrivning tillgänglig.";

  const metadata = integration.metadata || {};
  const metaEntries = Object.entries(metadata).filter(
    ([key]) => !["description", "awaiting_api_key"].includes(key)
  );

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error("Ange en API-nyckel");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("update-integration-secret", {
        body: { slug: integration.slug, secret_name: secretName, secret_value: apiKey.trim() },
      });
      if (error) throw error;
      toast.success("API-nyckel uppdaterad");
      setApiKey("");
      setShowKey(false);
      onRefresh();
    } catch (e: any) {
      toast.error(`Kunde inte spara: ${e.message || "Okänt fel"}`);
    } finally {
      setSaving(false);
    }
  };

  const testIntegration = async () => {
    setTesting(true);
    try {
      const fnMap: Record<string, string> = {
        "cision-feed": "fetch-cision-feed",
        "content-index": "sync-content-index",
      };
      const fnName = fnMap[integration.slug];
      if (!fnName) {
        toast.info("Denna integration kan inte testas manuellt ännu");
        return;
      }
      const { error } = await supabase.functions.invoke(fnName);
      if (error) throw error;
      toast.success("Test klart – uppdaterar status…");
      setTimeout(onRefresh, 2000);
    } catch (e: any) {
      toast.error(`Test misslyckades: ${e.message || "Okänt fel"}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${sc.bg}`}>
              <Icon className={`h-5 w-5 ${sc.color}`} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">{integration.name}</DialogTitle>
              <Badge variant="outline" className={`${sc.bg} ${sc.color} border-0 text-[11px] mt-1`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {sc.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Description */}
        <div className="flex gap-2 items-start bg-muted/50 rounded-lg p-3 mt-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <Separator />

        {/* Status Details */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Statusinformation</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[11px] text-muted-foreground">Senaste synk</p>
                <p className="text-sm font-medium text-foreground">
                  {integration.last_sync_at
                    ? formatDistanceToNow(new Date(integration.last_sync_at), { addSuffix: true, locale: sv })
                    : "Aldrig"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-3">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[11px] text-muted-foreground">Antal fel</p>
                <p className={`text-sm font-medium ${integration.error_count > 0 ? "text-destructive" : "text-foreground"}`}>
                  {integration.error_count} st
                </p>
              </div>
            </div>
          </div>

          {integration.last_sync_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Exakt tid: {format(new Date(integration.last_sync_at), "yyyy-MM-dd HH:mm:ss", { locale: sv })}
            </div>
          )}

          {/* Last error */}
          {integration.last_error && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">Senaste felmeddelande</p>
              <div className="text-destructive/80 bg-destructive/5 rounded-lg p-3 text-xs break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
                {integration.last_error}
              </div>
            </div>
          )}
        </div>

        {/* Metadata */}
        {metaEntries.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Metadata</h3>
              <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                {metaEntries.map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-mono">{key}</span>
                    <span className="text-foreground font-medium max-w-[200px] truncate">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* API Key Management */}
        {secretName && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Key className="h-4 w-4" />
                API-nyckel
              </h3>
              <p className="text-xs text-muted-foreground">
                Hemligt namn: <code className="bg-secondary px-1.5 py-0.5 rounded text-[11px] font-mono">{secretName}</code>
              </p>
              <div className="space-y-2">
                <Label htmlFor="api-key" className="text-xs">Ny API-nyckel</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="api-key"
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Klistra in ny nyckel…"
                      className="pr-10 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveApiKey}
                    disabled={saving || !apiKey.trim()}
                    className="shrink-0"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Spara
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Nyckeln lagras säkert och är aldrig synlig i koden.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <Separator />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Stäng
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={testIntegration}
            disabled={testing || !["cision-feed", "content-index"].includes(integration.slug)}
          >
            {testing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : null}
            Testa anslutning
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
