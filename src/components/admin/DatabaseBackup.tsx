import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, HardDrive, Loader2, CheckCircle2, AlertCircle, Cloud } from "lucide-react";
import { toast } from "sonner";

export default function DatabaseBackup() {
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [lastDriveBackup, setLastDriveBackup] = useState<{ name: string; webViewLink?: string } | null>(null);

  const callBackup = async (uploadToDrive: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Du måste vara inloggad");
      return null;
    }
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return fetch(`https://${projectId}.supabase.co/functions/v1/database-backup`, {
      method: uploadToDrive ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: uploadToDrive ? JSON.stringify({ upload_to_drive: true }) : undefined,
    });
  };

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const res = await callBackup(false);
      if (!res) return;
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

  const handleDriveBackup = async () => {
    setUploading(true);
    try {
      const res = await callBackup(true);
      if (!res) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uppladdning misslyckades");
      setLastDriveBackup({ name: data.drive_file?.name, webViewLink: data.drive_file?.webViewLink });
      toast.success("Backup sparad i Google Drive!");
    } catch (err: any) {
      console.error("Drive backup error:", err);
      toast.error(err.message || "Kunde inte spara till Google Drive");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">Databasbackup</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Exportera allt som behövs för att återskapa intranätet på en annan plattform.
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
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>Alla tabeller och alla rader</li>
              <li>Databasens uppbyggnad: kolumner, regler, behörigheter, funktioner och schemalagda jobb</li>
              <li>Användarkonton (utan lösenord)</li>
              <li>Alla filer som nedladdningslänkar, giltiga i 7 dagar</li>
              <li>Namn på de hemliga nycklar som måste läggas in igen</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Komplettera gärna med plattformens egen databasexport för en direkt återläsbar kopia.
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

        {/* Google Drive backup */}
        <Card className="border-t-4 border-t-accent/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/40 shadow-lg">
                <Cloud className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Google Drive</CardTitle>
                <CardDescription>Spara backup i molnet</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Skapar samma fullständiga backup och sparar den i mappen <strong>SHF Intra Backups</strong> i det anslutna Google-kontots Drive.
            </p>
            <Button
              onClick={handleDriveBackup}
              disabled={uploading || downloading}
              variant="outline"
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Laddar upp till Drive...
                </>
              ) : (
                <>
                  <Cloud className="h-4 w-4 mr-2" />
                  Spara backup till Google Drive
                </>
              )}
            </Button>
            {lastDriveBackup && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {lastDriveBackup.webViewLink ? (
                  <a href={lastDriveBackup.webViewLink} target="_blank" rel="noreferrer" className="underline">
                    {lastDriveBackup.name}
                  </a>
                ) : (
                  <span>Senast uppladdad: {lastDriveBackup.name}</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
