import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, HardDrive, Loader2, CheckCircle2, AlertCircle, Cloud } from "lucide-react";
import { toast } from "sonner";

export default function DatabaseBackup() {
  const [downloading, setDownloading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Du måste vara inloggad");
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/database-backup`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Backup misslyckades");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `shf-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastBackup(new Date().toLocaleString("sv-SE"));
      toast.success("Backup nedladdad!");
    } catch (err: any) {
      console.error("Backup error:", err);
      toast.error(err.message || "Kunde inte skapa backup");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">Databasbackup</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Exportera en fullständig backup av alla databastabeller som JSON.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Download backup */}
        <Card className="border-t-4 border-t-primary/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-foreground/20 shadow-lg">
                <Download className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Ladda ner backup</CardTitle>
                <CardDescription>Exportera som JSON-fil</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Skapar en komplett export av alla tabeller i databasen och laddar ner den som en JSON-fil.
            </p>
            <Button
              onClick={handleDownloadBackup}
              disabled={downloading}
              className="w-full"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Skapar backup...
                </>
              ) : (
                <>
                  <HardDrive className="h-4 w-4 mr-2" />
                  Skapa & ladda ner backup
                </>
              )}
            </Button>
            {lastBackup && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Senaste backup: {lastBackup}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Google Drive placeholder */}
        <Card className="border-t-4 border-t-muted-foreground/20 opacity-70">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-muted-foreground/40 to-muted-foreground/20 shadow-lg">
                <Cloud className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Google Drive</CardTitle>
                <CardDescription>Automatisk molnbackup</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Spara backuper automatiskt till Google Drive. Kräver att Google Drive-anslutning konfigureras.
            </p>
            <Button variant="outline" disabled className="w-full">
              <AlertCircle className="h-4 w-4 mr-2" />
              Ej konfigurerad
            </Button>
            <p className="text-xs text-muted-foreground">
              Kontakta administratören för att aktivera Google Drive-integration.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
