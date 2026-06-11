import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

type Kind = "onboarding" | "offboarding";

export default function BoardingNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const kind: Kind = (params.get("kind") as Kind) || "onboarding";

  const [templates, setTemplates] = useState<{ id: string; name: string; is_default: boolean }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [prospectiveName, setProspectiveName] = useState("");
  const [prospectiveEmail, setProspectiveEmail] = useState("");
  const [prospectiveTitle, setProspectiveTitle] = useState("");
  const [managerId, setManagerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [exitReason, setExitReason] = useState<string>("voluntary");
  const [exitType, setExitType] = useState<string>("normal");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, p] = await Promise.all([
        supabase.from("onboarding_templates").select("id, name, is_default").eq("kind", kind).eq("is_active", true).order("name"),
        supabase.from("profiles").select("id, full_name").eq("is_hidden", false).order("full_name"),
      ]);
      setTemplates((t.data ?? []) as any);
      setProfiles((p.data ?? []) as any);
      const def = (t.data ?? []).find(x => x.is_default) ?? t.data?.[0];
      if (def) setTemplateId(def.id);
    })();
  }, [kind]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId) { toast.error("Välj mall"); return; }
    if (kind === "onboarding" && !startDate) { toast.error("Ange startdatum"); return; }
    if (kind === "offboarding" && !lastDay) { toast.error("Ange sista dag"); return; }
    if (kind === "offboarding" && !profileId) { toast.error("Välj medarbetare"); return; }
    if (kind === "onboarding" && !profileId && !prospectiveName) { toast.error("Välj eller ange namn"); return; }

    setSubmitting(true);
    const payload: any = {
      template_id: templateId,
      profile_id: profileId || null,
      prospective_name: profileId ? null : prospectiveName,
      prospective_email: profileId ? null : prospectiveEmail || null,
      prospective_title: prospectiveTitle || null,
      nearest_manager_id: managerId || null,
      start_date: kind === "onboarding" ? startDate : null,
      last_day: kind === "offboarding" ? lastDay : null,
      exit_reason: kind === "offboarding" ? exitReason : null,
      exit_type: kind === "offboarding" ? exitType : null,
      status: "pending_hr",
      initiated_by: user?.id,
      notes: notes || null,
    };
    const { data, error } = await supabase
      .from("onboarding_instances")
      .insert(payload)
      .select("id")
      .single();
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${kind === "onboarding" ? "Onboarding" : "Offboarding"} skapad`);
    navigate(`/boarding/${data.id}`);
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto animate-fade-up">
      <Button variant="ghost" size="sm" onClick={() => navigate("/boarding")}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Tillbaka
      </Button>
      <Card className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-heading font-bold">
            Ny {kind === "onboarding" ? "onboarding" : "offboarding"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">HR bekräftar och startar utskick efter att du skapat ärendet.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Mall</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Välj mall" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{kind === "onboarding" ? "Befintlig profil (om finns)" : "Medarbetare som slutar"}</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger><SelectValue placeholder={kind === "onboarding" ? "(lämna tom för ny person)" : "Välj"} /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {kind === "onboarding" && !profileId && (
            <>
              <div>
                <Label>Namn på nyanställd</Label>
                <Input value={prospectiveName} onChange={(e) => setProspectiveName(e.target.value)} />
              </div>
              <div>
                <Label>E-post (om känd)</Label>
                <Input type="email" value={prospectiveEmail} onChange={(e) => setProspectiveEmail(e.target.value)} />
              </div>
            </>
          )}

          <div>
            <Label>Befattning</Label>
            <Input value={prospectiveTitle} onChange={(e) => setProspectiveTitle(e.target.value)} />
          </div>

          <div>
            <Label>Närmaste chef</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger><SelectValue placeholder="Välj" /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {kind === "onboarding" ? (
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
            {submitting ? "Skapar..." : "Skapa ärende"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
