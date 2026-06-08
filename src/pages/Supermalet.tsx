import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Plane, CheckCircle2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";

const schema = z.object({
  lastName: z.string().trim().min(1, "Efternamn krävs").max(100),
  firstName: z.string().trim().min(1, "För-/mellannamn krävs").max(100),
  personalNumber: z.string().trim().min(8, "Personnummer krävs").max(20),
  passportNumber: z.string().trim().min(3, "Passnummer krävs").max(30),
  issuedDate: z.string().min(1, "Utfärdat datum krävs"),
  validUntil: z.string().min(1, "Giltigt till krävs"),
  birthPlace: z.string().trim().min(1, "Födelseort krävs").max(100),
  allergies: z.string().max(500).optional(),
});

type FormState = z.infer<typeof schema>;

const empty: FormState = {
  lastName: "",
  firstName: "",
  personalNumber: "",
  passportNumber: "",
  issuedDate: "",
  validUntil: "",
  birthPlace: "",
  allergies: "",
};

export default function Supermalet() {
  const { user, profile, roles } = useAuth();
  const isAdmin = roles?.includes("admin") || roles?.includes("it");
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      const parts = profile.full_name.trim().split(/\s+/);
      const ln = parts.length > 1 ? parts[parts.length - 1] : "";
      const fn = parts.length > 1 ? parts.slice(0, -1).join(" ") : profile.full_name;
      setForm((f) => ({ ...f, firstName: f.firstName || fn, lastName: f.lastName || ln }));
    }
  }, [profile?.full_name]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Kontrollera fälten", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error: insErr } = await supabase
        .from("supermalet_registrations" as any)
        .insert({
          user_id: user.id,
          last_name: parsed.data.lastName,
          first_name: parsed.data.firstName,
          personal_number: parsed.data.personalNumber,
          passport_number: parsed.data.passportNumber,
          issued_date: parsed.data.issuedDate,
          valid_until: parsed.data.validUntil,
          birth_place: parsed.data.birthPlace,
          allergies: parsed.data.allergies || null,
        });
      if (insErr) throw insErr;

      setDone(true);
      toast({ title: "Anmälan sparad!", description: "Tack – vi har tagit emot dina uppgifter." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Kunde inte spara anmälan", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("supermalet_registrations" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      if (rows.length === 0) {
        toast({ title: "Inga anmälningar att exportera ännu." });
        return;
      }

      const sheetData = rows.map((r) => ({
        "Efternamn": r.last_name ?? "",
        "För-/mellannamn": r.first_name ?? "",
        "Personnummer": r.personal_number ?? "",
        "Passnummer": r.passport_number ?? "",
        "Utfärdat": r.issued_date ?? "",
        "Giltigt till": r.valid_until ?? "",
        "Födelseort": r.birth_place ?? "",
        "Allergier": r.allergies ?? "",
        "Anmäld": r.created_at ? new Date(r.created_at).toLocaleString("sv-SE") : "",
      }));

      const ws = XLSX.utils.json_to_sheet(sheetData);
      ws["!cols"] = [
        { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 18 },
      ];
      // Bold header row
      const range = XLSX.utils.decode_range(ws["!ref"] as string);
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        const cell = ws[addr];
        if (cell) {
          cell.s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2E4A62" } },
            alignment: { horizontal: "left", vertical: "center" },
          };
        }
      }
      ws["!autofilter"] = { ref: ws["!ref"] as string };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Supermålet");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `supermalet-anmalningar-${stamp}.xlsx`);
      toast({ title: "Exporterat", description: `${rows.length} anmälningar nedladdade.` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Export misslyckades", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="glass-card">
          <CardContent className="p-10 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
            <h1 className="font-heading text-2xl font-bold">Tack för din anmälan!</h1>
            <p className="text-muted-foreground">
              Dina uppgifter har sparats. Thomas och Christel hör av sig inom kort.
            </p>
            <Button onClick={() => navigate("/dashboard")} className="mt-2">Tillbaka till start</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Plane className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold">Anmälan: Supermålet-resan</h1>
          <p className="text-sm text-muted-foreground">Fyll i dina uppgifter nedan.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Personuppgifter</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id="lastName" label="Efternamn" value={form.lastName} onChange={(v) => update("lastName", v)} required />
            <Field id="firstName" label="För-/mellannamn" value={form.firstName} onChange={(v) => update("firstName", v)} required />
            <Field id="personalNumber" label="Personnummer (ÅÅÅÅMMDD-XXXX)" value={form.personalNumber} onChange={(v) => update("personalNumber", v)} required />
            <Field id="birthPlace" label="Födelseort" value={form.birthPlace} onChange={(v) => update("birthPlace", v)} required />
          </CardContent>
        </Card>

        <Card className="glass-card mt-4">
          <CardHeader>
            <CardTitle className="text-base">Passuppgifter</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id="passportNumber" label="Passnummer" value={form.passportNumber} onChange={(v) => update("passportNumber", v)} required />
            <div />
            <Field id="issuedDate" label="Utfärdat datum" type="date" value={form.issuedDate} onChange={(v) => update("issuedDate", v)} required />
            <Field id="validUntil" label="Giltigt till" type="date" value={form.validUntil} onChange={(v) => update("validUntil", v)} required />
          </CardContent>
        </Card>

        <Card className="glass-card mt-4">
          <CardHeader>
            <CardTitle className="text-base">Övrigt</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="allergies">Allergier (eller annat vi behöver veta)</Label>
            <Textarea
              id="allergies"
              className="mt-1.5"
              rows={3}
              value={form.allergies}
              onChange={(e) => update("allergies", e.target.value)}
              placeholder="T.ex. nötter, laktos, gluten – eller lämna tomt."
              maxLength={500}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate("/dashboard")} disabled={submitting}>
            Avbryt
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sparar..." : "Skicka anmälan"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  id, label, value, onChange, required, type = "text",
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="mt-1.5" />
    </div>
  );
}
