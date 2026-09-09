import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, FlaskConical } from "lucide-react";
import { type BoardingKind, type BoardingTemplate, EMPLOYMENT_FORMS } from "./boardingV2";

/**
 * Manuellt ärende – eller en simulerad Heartpace-post. Båda går genom samma
 * create-väg i boarding-case-advance som Heartpace-intaget kommer att använda.
 */
export default function BoardingV2New() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const kind: BoardingKind = params.get("kind") === "offboarding" ? "offboarding" : "onboarding";

  const [templates, setTemplates] = useState<BoardingTemplate[]>([]);
  type ProfileOption = { id: string; full_name: string; email: string; department: string | null; title_override: string | null; manager_id: string | null };
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  const [templateId, setTemplateId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [costCentre, setCostCentre] = useState("");
  const [employmentForm, setEmploymentForm] = useState("");
  const [managerId, setManagerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [exitReason, setExitReason] = useState("voluntary");
  const [exitType, setExitType] = useState("normal");
  const [notes, setNotes] = useState("");
  const [simulate, setSimulate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, p, d] = await Promise.all([
        supabase.from("boarding_templates").select("id, kind, name, description, is_default, require_hr_confirm").eq("kind", kind).eq("is_active", true).order("name"),
        supabase.from("profiles").select("id, full_name, email, department, title_override, manager_id").eq("is_hidden", false).eq("is_external", false).order("full_name"),
        supabase.from("departments").select("name").order("name"),
      ]);
      const tpls = (t.data ?? []) as unknown as BoardingTemplate[];
      setTemplates(tpls);
      setProfiles((p.data ?? []) as unknown as ProfileOption[]);
      setDepartments(((d.data ?? []) as { name: string }[]).map((x) => x.name));
      const def = tpls.find((x) => x.is_default) ?? tpls[0];
      if (def) setTemplateId(def.id);
    })();
  }, [kind]);

  // Offboarding: förifyll från vald profil
  useEffect(() => {
    if (kind !== "offboarding" || !profileId) return;
    const p = profiles.find((x) => x.id === profileId);
    if (!p) return;
    const parts = (p.full_name ?? "").trim().split(/\s+/);
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" "));
    setWorkEmail(p.email ?? "");
    setTitle(p.title_override ?? "");
    setDepartment(p.department ?? "");
    if (p.manager_id) setManagerId(p.manager_id);
  }, [profileId, kind, profiles]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId) { toast.error("Välj mall"); return; }
    if (kind === "offboarding" && !profileId) { toast.error("Välj medarbetare som slutar"); return; }
    if (!firstName.trim() || !lastName.trim()) { toast.error("För- och efternamn krävs"); return; }
    if (kind === "onboarding" && !startDate) { toast.error("Ange startdatum"); return; }
    if (kind === "offboarding" && !lastDay) { toast.error("Ange sista dag"); return; }
    if (!managerId) { toast.error("Välj närmaste chef – det är chefen som får nästa steg"); return; }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("boarding-case-advance", {
      body: {
        action: "create",
        kind,
        templateId,
        triggerSource: simulate ? "simulated" : "manual",
        profileId: profileId || null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        workEmail: workEmail || null,
        personalEmail: personalEmail || null,
        title: title || null,
        department: department || null,
        location: location || null,
        costCentre: costCentre || null,
        employmentForm: employmentForm || null,
        nearestManagerId: managerId,
        startDate: kind === "onboarding" ? startDate : null,
        lastDay: kind === "offboarding" ? lastDay : null,
        exitReason: kind === "offboarding" ? exitReason : null,
        exitType: kind === "offboarding" ? exitType : null,
        notes: notes || null,
      },
    });
    setSubmitting(false);
    if (error || data?.error) { toast.error(error?.message ?? data?.error); return; }
    toast.success(data?.managerNotified ? "Ärende skapat – chefen har fått mejl" : "Ärende skapat");
    navigate(`/boardingv2/${data.caseId}`);
  }

  const isOn = kind === "onboarding";

  return (
    <div className="space-y-4 max-w-2xl mx-auto animate-fade-up">
      <Button variant="ghost" size="sm" onClick={() => navigate("/boardingv2")}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Tillbaka
      </Button>
      <Card className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-heading font-bold">{isOn ? "Ny onboarding" : "Ny offboarding"} <span className="text-muted-foreground font-normal text-base">(v2)</span></h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fälten motsvarar det som Heartpace levererar. Närmaste chef får ett mejl och gör sina val i nästa steg.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3 bg-secondary/30">
            <div className="flex items-start gap-2">
              <FlaskConical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Simulera Heartpace-post</p>
                <p className="text-xs text-muted-foreground">Markerar ärendet som simulerat. Går genom exakt samma väg som det riktiga intaget kommer att göra.</p>
              </div>
            </div>
            <Switch checked={simulate} onCheckedChange={setSimulate} />
          </div>

          <div>
            <Label>Mall</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Välj mall" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}{t.require_hr_confirm ? " · HR bekräftar" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isOn && (
            <div>
              <Label>Medarbetare som slutar</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger><SelectValue placeholder="Välj" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Förnamn</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label>Efternamn</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Arbetsmejl</Label>
              <Input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="fornamn.efternamn@handelsfastigheter.se" />
            </div>
            {isOn && (
              <div>
                <Label>Privat e-post <span className="text-muted-foreground">(kontakt före start)</span></Label>
                <Input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Befattning</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Avdelning</Label>
              <Input list="boardingv2-departments" value={department} onChange={(e) => setDepartment(e.target.value)} />
              <datalist id="boardingv2-departments">
                {departments.map((d) => <option key={d} value={d} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Ort</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Stockholm" />
            </div>
            <div>
              <Label>Kostnadsställe</Label>
              <Input value={costCentre} onChange={(e) => setCostCentre(e.target.value)} />
            </div>
            <div>
              <Label>Anställningsform</Label>
              <Select value={employmentForm} onValueChange={setEmploymentForm}>
                <SelectTrigger><SelectValue placeholder="Välj" /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_FORMS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Närmaste chef</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger><SelectValue placeholder="Välj" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isOn ? (
            <div>
              <Label>Startdatum</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          ) : (
            <>
              <div>
                <Label>Sista anställningsdag</Label>
                <Input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Orsak</Label>
                  <Select value={exitReason} onValueChange={setExitReason}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voluntary">Egen uppsägning</SelectItem>
                      <SelectItem value="employer">Arbetsgivarens uppsägning</SelectItem>
                      <SelectItem value="retirement">Pension</SelectItem>
                      <SelectItem value="other">Annat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Typ</Label>
                  <Select value={exitType} onValueChange={setExitType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="immediate">Snabbavslut (samma dag)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div>
            <Label>Anteckningar</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Skapar..." : "Skapa ärende och meddela chefen"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
