import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  defaultYear: number;
  defaultQuarter: number;
}

export default function KpiUploadDialog({ defaultYear, defaultQuarter }: Props) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number>(defaultYear);
  const [quarter, setQuarter] = useState<number>(defaultQuarter);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const handleUpload = async () => {
    if (!file) { toast.error("Välj en .xlsx-fil"); return; }
    setBusy(true);
    try {
      const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${year}-Q${quarter}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("kpi-uploads").upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data, error } = await supabase.functions.invoke("import-kpi-excel", {
        body: { storage_path: path, year, quarter, replace: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(`Importerade ${(data as any).inserted} rader för Q${quarter} ${year}`);
      qc.invalidateQueries({ queryKey: ["kpi-data"] });
      qc.invalidateQueries({ queryKey: ["kpi-periods"] });
      setOpen(false);
      setFile(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Import misslyckades");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Ladda upp Excel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importera KPI från Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>År</Label>
              <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || defaultYear)} />
            </div>
            <div>
              <Label>Kvartal</Label>
              <Select value={String(quarter)} onValueChange={(v) => setQuarter(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Excel-fil (.xlsx)</Label>
            <Input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground mt-2">
              Använd kvartalsfilen "Översikt stretch". Värdena hämtas från flikarna <strong>Sammanställning</strong> (driftnetto, överskottsgrad, vakansgrad, duration, fastighetsvärde), <strong>Fastigheter per region</strong> (hyresvärde, antal fastigheter) och <strong>Optionsprogram</strong> (aktiekurs) för valt kvartal.
            </p>

          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Avbryt</Button>
          <Button onClick={handleUpload} disabled={busy || !file}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Importera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
