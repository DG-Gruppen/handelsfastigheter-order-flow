import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Mail, Phone, Building2 } from "lucide-react";
import { toast } from "sonner";

interface ExternalContact {
  id: string;
  company_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

const contactSchema = z.object({
  company_name: z.string().trim().max(120).optional().or(z.literal("")),
  full_name: z.string().trim().min(1, "Namn krävs").max(120),
  email: z.string().trim().max(255).email("Ogiltig e-postadress").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export default function ExternalContactsManager() {
  const [contacts, setContacts] = useState<ExternalContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalContact | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExternalContact | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("external_contacts" as any)
      .select("*")
      .order("company_name", { ascending: true, nullsFirst: false })
      .order("full_name");
    if (error) {
      toast.error("Kunde inte hämta kontakter: " + error.message);
    } else {
      setContacts(((data ?? []) as unknown) as ExternalContact[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const resetForm = () => {
    setCompanyName(""); setFullName(""); setEmail("");
    setPhone(""); setNotes(""); setIsActive(true);
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (c: ExternalContact) => {
    setEditing(c);
    setCompanyName(c.company_name ?? "");
    setFullName(c.full_name);
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setNotes(c.notes ?? "");
    setIsActive(c.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const parsed = contactSchema.safeParse({
      company_name: companyName,
      full_name: fullName,
      email,
      phone,
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ogiltig data");
      return;
    }
    const payload = {
      company_name: parsed.data.company_name?.trim() || null,
      full_name: parsed.data.full_name.trim(),
      email: parsed.data.email?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
      is_active: isActive,
    };

    if (editing) {
      const { error } = await supabase
        .from("external_contacts" as any)
        .update(payload)
        .eq("id", editing.id);
      if (error) { toast.error("Kunde inte uppdatera: " + error.message); return; }
      toast.success("Kontakt uppdaterad");
    } else {
      const { error } = await supabase
        .from("external_contacts" as any)
        .insert(payload);
      if (error) { toast.error("Kunde inte skapa: " + error.message); return; }
      toast.success("Kontakt skapad");
    }
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (c: ExternalContact) => {
    const { error } = await supabase
      .from("external_contacts" as any)
      .delete()
      .eq("id", c.id);
    if (error) { toast.error("Kunde inte ta bort: " + error.message); return; }
    toast.success("Kontakt borttagen");
    setConfirmDelete(null);
    fetchAll();
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? contacts.filter(c =>
        (c.company_name ?? "").toLowerCase().includes(q) ||
        c.full_name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
      )
    : contacts;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Externa kontakter</h2>
          <p className="text-sm text-muted-foreground">
            Register över externa personer (t.ex. leverantörer och konsulter). Kan kopplas som verktygsägare.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Ny kontakt
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök efter företag, namn, e-post eller telefon…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          {contacts.length === 0
            ? "Inga externa kontakter ännu. Klicka på \"Ny kontakt\" för att lägga till."
            : "Inga kontakter matchar sökningen."}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`flex items-start gap-3 p-3 rounded-lg border border-border bg-card ${
                c.is_active ? "" : "opacity-60"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {c.full_name}
                  </p>
                  {!c.is_active && (
                    <Badge variant="secondary" className="text-[10px]">Inaktiv</Badge>
                  )}
                </div>
                {c.company_name && (
                  <p className="text-xs text-muted-foreground truncate">{c.company_name}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="inline-flex items-center gap-1 hover:text-primary"
                    >
                      <Mail className="h-3 w-3" /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="inline-flex items-center gap-1 hover:text-primary"
                    >
                      <Phone className="h-3 w-3" /> {c.phone}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Redigera">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDelete(c)}
                  aria-label="Ta bort"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Redigera extern kontakt" : "Ny extern kontakt"}</DialogTitle>
            <DialogDescription>
              Externa personer kan användas som verktygsägare eller mottagare utan att de loggar in i systemet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Företagsnamn</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="t.ex. Fastighetssnabben AB"
                maxLength={120}
              />
            </div>
            <div>
              <Label>Namn <span className="text-destructive">*</span></Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="För- och efternamn"
                maxLength={120}
                autoFocus
              />
            </div>
            <div>
              <Label>E-postadress</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@foretag.se"
                maxLength={255}
              />
            </div>
            <div>
              <Label>Telefonnummer</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+46 70 123 45 67"
                maxLength={40}
              />
            </div>
            <div>
              <Label>Anteckningar</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Roll, ansvar, övrig info…"
                rows={3}
                maxLength={1000}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Aktiv</p>
                <p className="text-xs text-muted-foreground">
                  Inaktiva kontakter göms i ägar­listor.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
              <Button onClick={handleSave} disabled={!fullName.trim()}>
                {editing ? "Spara" : "Lägg till"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort extern kontakt</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort{" "}
              <span className="font-semibold">{confirmDelete?.full_name}</span>?
              Alla kopplingar till verktyg som ägare tas också bort.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
