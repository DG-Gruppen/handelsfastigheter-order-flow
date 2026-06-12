import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Plane, CheckCircle2, Download, Users, Trash2, Info, Mail, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModulePermission } from "@/hooks/useModulePermission";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const NATIONALITIES = [
  "Svensk", "Norsk", "Dansk", "Finsk", "Isländsk",
  "Amerikansk", "Australisk", "Belgisk", "Brittisk", "Bulgarisk",
  "Estnisk", "Fransk", "Grekisk", "Indisk", "Irländsk", "Italiensk",
  "Japansk", "Kanadensisk", "Kinesisk", "Kroatisk", "Lettisk", "Litauisk",
  "Nederländsk", "Polsk", "Portugisisk", "Rumänsk", "Rysk", "Schweizisk",
  "Slovakisk", "Slovensk", "Spansk", "Sydkoreansk", "Tjeckisk", "Turkisk",
  "Tysk", "Ukrainsk", "Ungersk", "Österrikisk", "Annan",
];

// Resedag — passet måste vara giltigt i minst 3 månader efter detta datum
const TRAVEL_DATE = new Date("2026-08-28");
const MIN_VALID_UNTIL = new Date(TRAVEL_DATE);
MIN_VALID_UNTIL.setMonth(MIN_VALID_UNTIL.getMonth() + 3);
const MIN_VALID_UNTIL_STR = MIN_VALID_UNTIL.toISOString().slice(0, 10);
const isPassportValidEnough = (validUntil: string) =>
  !!validUntil && new Date(validUntil) >= MIN_VALID_UNTIL;

const schema = z.object({
  lastName: z.string().trim().min(1, "Efternamn krävs").max(100),
  firstName: z.string().trim().min(1, "För-/mellannamn krävs").max(100),
  personalNumber: z.string().trim().min(8, "Personnummer krävs").max(20),
  birthPlace: z.string().trim().min(1, "Födelseort krävs").max(100),
  nationality: z.string().trim().min(1, "Nationalitet krävs").max(50),
  passportNumber: z.string().trim().min(1, "Passnummer krävs").max(50),
  issuedDate: z.string().trim().min(1, "Utfärdat datum krävs"),
  validUntil: z.string().trim().min(1, "Giltigt till krävs"),
  shirtSize: z.string().trim().min(1, "Storlek krävs").max(10),
  allergies: z.string().max(500).optional(),
});

type FormState = z.infer<typeof schema> & { otherNationality: string };

const empty: FormState = {
  lastName: "",
  firstName: "",
  personalNumber: "",
  birthPlace: "",
  nationality: "Svensk",
  otherNationality: "",
  passportNumber: "",
  issuedDate: "",
  validUntil: "",
  shirtSize: "",
  allergies: "",
};

export default function Supermalet() {
  const { user, profile } = useAuth();
  const { canEdit: canExport } = useModulePermission("supermalet");
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [registrationsOpen, setRegistrationsOpen] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

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
    if (!isPassportValidEnough(parsed.data.validUntil)) {
      toast({
        title: "Passet är inte giltigt tillräckligt länge",
        description: `Passet måste vara giltigt minst 3 månader efter resedagen (${TRAVEL_DATE.toLocaleDateString("sv-SE")}). Tidigast giltigt till: ${MIN_VALID_UNTIL.toLocaleDateString("sv-SE")}.`,
        variant: "destructive",
      });
      return;
    }
    let finalNationality = parsed.data.nationality;
    if (parsed.data.nationality === "Annan") {
      if (!form.otherNationality.trim()) {
        toast({ title: "Ange nationalitet", description: "Fyll i nationalitet när 'Annan' är vald.", variant: "destructive" });
        return;
      }
      finalNationality = form.otherNationality.trim();
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
          birth_place: parsed.data.birthPlace,
          nationality: finalNationality,
          passport_number: parsed.data.passportNumber,
          issued_date: parsed.data.issuedDate,
          valid_until: parsed.data.validUntil,
          shirt_size: parsed.data.shirtSize,
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

  const buildWorkbook = async (): Promise<{ wb: XLSX.WorkBook; count: number } | null> => {
    const { data, error } = await supabase
      .from("supermalet_registrations" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as any[];
    if (rows.length === 0) {
      toast({ title: "Inga anmälningar att exportera ännu." });
      return null;
    }

    const sheetData = rows.map((r) => ({
      "Efternamn": r.last_name ?? "",
      "För-/mellannamn": r.first_name ?? "",
      "Personnummer": r.personal_number ?? "",
      "Födelseort": r.birth_place ?? "",
      "Nationalitet": r.nationality ?? "",
      "Passnummer": r.passport_number ?? "",
      "Utfärdat datum": r.issued_date ?? "",
      "Giltigt till": r.valid_until ?? "",
      "Skjorta/T-shirt": r.shirt_size ?? "",
      "Allergier": r.allergies ?? "",
      "Anmäld": r.created_at ? new Date(r.created_at).toLocaleString("sv-SE") : "",
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 18 },
    ];
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
    return { wb, count: rows.length };
  };

  const handleDownloadExport = async () => {
    setExporting(true);
    try {
      const result = await buildWorkbook();
      if (!result) return;
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(result.wb, `supermalet-anmalningar-${stamp}.xlsx`);
      toast({ title: "Exporterat", description: `${result.count} anmälningar nedladdade.` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Export misslyckades", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleEmailExport = async () => {
    if (!user?.email) {
      toast({ title: "Ingen e-postadress", description: "Din profil saknar e-post.", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const result = await buildWorkbook();
      if (!result) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const arrayBuffer = XLSX.write(result.wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      const fileName = `supermalet-anmalningar-${stamp}.xlsx`;
      const path = `${user.id}/${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("supermalet-exports")
        .upload(path, new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true,
        });
      if (upErr) throw upErr;
      const expiresIn = 60 * 60 * 24 * 7; // 7 days
      const { data: signed, error: signErr } = await supabase.storage
        .from("supermalet-exports")
        .createSignedUrl(path, expiresIn);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Kunde inte skapa nedladdningslänk");

      const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "supermalet-export",
          recipientEmail: user.email,
          idempotencyKey: `supermalet-export-${user.id}-${stamp}`,
          templateData: {
            recipientName: profile?.full_name?.split(/\s+/)[0] ?? "",
            downloadUrl: signed.signedUrl,
            count: result.count,
            expiresHours: 168,
          },
        },
      });
      if (mailErr) throw mailErr;
      toast({ title: "Skickat", description: `Exporten har mejlats till ${user.email}.` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Kunde inte mejla export", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };


  const fetchRegistrations = async () => {
    setRegistrationsLoading(true);
    try {
      const { data, error } = await supabase
        .from("supermalet_registrations" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRegistrations(data ?? []);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Kunde inte hämta anmälningar", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Är du säker på att du vill radera denna anmälan?")) return;
    try {
      const { error } = await supabase
        .from("supermalet_registrations" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Anmälan raderad" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Kunde inte radera", description: err.message ?? String(err), variant: "destructive" });
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
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Plane className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold">Anmälan: Supermålet-resan</h1>
            <p className="text-sm text-muted-foreground">Fyll i dina uppgifter nedan.</p>
          </div>
        </div>
        {canExport && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRegistrationsOpen(true);
                fetchRegistrations();
              }}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              Anmälningar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" disabled={exporting} className="gap-2">
                  <Download className="w-4 h-4" />
                  {exporting ? "Exporterar..." : "Exportera"}
                  <ChevronDown className="w-4 h-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadExport} className="gap-2">
                  <Download className="w-4 h-4" />
                  Ladda ner Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleEmailExport} className="gap-2">
                  <Mail className="w-4 h-4" />
                  Maila till mig
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle>Viktigt om namn</AlertTitle>
        <AlertDescription>
          Skriv dina namn exakt som de står i passet – inklusive alla förnamn, efternamn och mellannamn. Det är viktigt för bokningen.
        </AlertDescription>
      </Alert>

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
            <div className={`grid gap-4 ${form.nationality === "Annan" ? "md:grid-cols-2" : "grid-cols-1"}`}>
              <div>
                <Label htmlFor="nationality">Nationalitet<span className="text-destructive"> *</span></Label>
                <Select value={form.nationality} onValueChange={(v) => update("nationality", v)}>
                  <SelectTrigger id="nationality" className="mt-1.5">
                    <SelectValue placeholder="Välj nationalitet" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {NATIONALITIES.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.nationality === "Annan" && (
                <div>
                  <Label htmlFor="otherNationality">Ange nationalitet<span className="text-destructive"> *</span></Label>
                  <Input
                    id="otherNationality"
                    value={form.otherNationality}
                    onChange={(e) => update("otherNationality", e.target.value)}
                    className="mt-1.5"
                    placeholder="Skriv in din nationalitet"
                    required
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card mt-4">
          <CardHeader>
            <CardTitle className="text-base">Passuppgifter</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
              <Info className="h-4 w-4 mt-0.5 text-warning shrink-0" />
              <p>
                Passet måste vara giltigt i minst 3 månader efter den dag du planerar att resa
                ({TRAVEL_DATE.toLocaleDateString("sv-SE")}). Tidigast giltigt till:{" "}
                <strong>{MIN_VALID_UNTIL.toLocaleDateString("sv-SE")}</strong>.
              </p>
            </div>
            <Field id="passportNumber" label="Passnummer" value={form.passportNumber} onChange={(v) => update("passportNumber", v)} required />
            <div />
            <Field id="issuedDate" label="Utfärdat datum" type="date" value={form.issuedDate} onChange={(v) => update("issuedDate", v)} required />
            <div>
              <Field id="validUntil" label="Giltigt till" type="date" value={form.validUntil} onChange={(v) => update("validUntil", v)} required min={MIN_VALID_UNTIL_STR} />
              {form.validUntil && !isPassportValidEnough(form.validUntil) && (
                <p className="mt-1.5 text-xs text-destructive">
                  Passet går ut för tidigt – måste vara giltigt minst t.o.m. {MIN_VALID_UNTIL.toLocaleDateString("sv-SE")}.
                </p>
              )}
            </div>
          </CardContent>
        </Card>


        <Card className="glass-card mt-4">
          <CardHeader>
            <CardTitle className="text-base">Övrigt</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shirtSize">Skjorta/T-shirt storlek<span className="text-destructive"> *</span></Label>
              <Select value={form.shirtSize} onValueChange={(v) => update("shirtSize", v)}>
                <SelectTrigger id="shirtSize" className="mt-1.5">
                  <SelectValue placeholder="Välj storlek" />
                </SelectTrigger>
                <SelectContent>
                  {["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
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
            </div>
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

      <Dialog open={registrationsOpen} onOpenChange={setRegistrationsOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Anmälningar – Supermålet</DialogTitle>
          </DialogHeader>
          {registrationsLoading ? (
            <p className="text-muted-foreground text-sm py-4">Laddar anmälningar…</p>
          ) : registrations.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">Inga anmälningar ännu.</p>
          ) : (
            <div className="flex-1 overflow-y-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Efternamn</TableHead>
                    <TableHead className="whitespace-nowrap">Förnamn</TableHead>
                    <TableHead className="whitespace-nowrap">Personnummer</TableHead>
                    <TableHead className="whitespace-nowrap">Födelseort</TableHead>
                    <TableHead className="whitespace-nowrap">Nationalitet</TableHead>
                    <TableHead className="whitespace-nowrap">Passnummer</TableHead>
                    <TableHead className="whitespace-nowrap">Utfärdat</TableHead>
                    <TableHead className="whitespace-nowrap">Giltigt till</TableHead>
                    <TableHead className="whitespace-nowrap">Storlek</TableHead>
                    <TableHead className="whitespace-nowrap">Allergier</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.last_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.first_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.personal_number}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.birth_place}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.nationality || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.passport_number || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.issued_date || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.valid_until || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.shirt_size || "—"}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{r.allergies || "—"}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  id, label, value, onChange, required, type = "text", min,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; min?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} min={min} className="mt-1.5" />
    </div>
  );
}
