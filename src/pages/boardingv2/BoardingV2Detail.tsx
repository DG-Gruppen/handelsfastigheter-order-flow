import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModules } from "@/hooks/useModules";
import { toast } from "sonner";
import {
  ChevronLeft, Check, X, Play, AlertCircle, RotateCcw, Send, ShieldCheck, Mail, Info, Sparkles, Users, FlaskConical,
} from "lucide-react";
import { useBoardingAccess } from "./useBoardingAccess";
import {
  type BoardingCase, type BoardingCaseTask, type BoardingTemplateTask, type BoardingPreview, type CaseStatus, type TaskStatus,
  AUTO_CONDITION_KEYS, STATUS_CLASS, STATUS_LABEL, TRIGGER_LABEL, EXIT_REASON_LABEL,
  personName, kindLabel, formatDate,
} from "./boardingV2";

interface EmailLogRow {
  id: string;
  template_key: string;
  recipient_email: string;
  redirected_from: string | null;
  sent_at: string;
  error: string | null;
}

const UNASSIGNED = "(ej tilldelad)";

export default function BoardingV2Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isStaff, isStab, profileId } = useBoardingAccess();
  const { userGroupIds } = useModules();
  const [myGroupNames, setMyGroupNames] = useState<string[]>([]);

  const [c, setCase] = useState<BoardingCase | null>(null);
  const [tasks, setTasks] = useState<BoardingCaseTask[]>([]);
  const [templateTasks, setTemplateTasks] = useState<BoardingTemplateTask[]>([]);
  const [toolOwners, setToolOwners] = useState<Record<string, string[]>>({});
  const [emailLog, setEmailLog] = useState<EmailLogRow[]>([]);
  const [progress, setProgress] = useState<{ total: number; done: number; pending: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [optionalKeys, setOptionalKeys] = useState<Set<string>>(new Set());
  const [managerNotes, setManagerNotes] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [preview, setPreview] = useState<BoardingPreview | null>(null);
  const [previewAction, setPreviewAction] = useState<"manager_submit" | "hr_confirm" | null>(null);

  useEffect(() => { if (id) load(); }, [id]);

  // Vilka grupper är jag med i? Styr om jag får bocka av gruppuppgifter (RLS avgör på riktigt).
  useEffect(() => {
    if (!userGroupIds.length) { setMyGroupNames([]); return; }
    supabase.from("groups").select("name").in("id", userGroupIds)
      .then(({ data }) => setMyGroupNames(((data ?? []) as { name: string }[]).map((g) => g.name.toLowerCase())));
  }, [userGroupIds]);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [caseRes, taskRes, logRes, progressRes] = await Promise.all([
      supabase
        .from("boarding_cases")
        .select("*, template:boarding_templates(id, kind, name, description, is_default, require_hr_confirm), manager:profiles!boarding_cases_nearest_manager_id_fkey(id, full_name, email)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("boarding_case_tasks")
        .select("*, assignee:profiles!boarding_case_tasks_assignee_profile_id_fkey(full_name, email)")
        .eq("case_id", id)
        .order("sort_order"),
      supabase
        .from("boarding_email_log")
        .select("id, template_key, recipient_email, redirected_from, sent_at, error")
        .eq("case_id", id)
        .order("sent_at", { ascending: false }),
      // Övergripande status oavsett hur många rader jag själv får se
      supabase.rpc("boarding_case_progress", { _case_id: id }).maybeSingle(),
    ]);
    setProgress((progressRes.data as { total: number; done: number; pending: number } | null) ?? null);

    const loaded = (caseRes.data ?? null) as unknown as BoardingCase | null;
    setCase(loaded);
    setTasks((taskRes.data ?? []) as unknown as BoardingCaseTask[]);
    setEmailLog((logRes.data ?? []) as unknown as EmailLogRow[]);

    if (loaded) {
      setSelectedTools(new Set(loaded.selected_tool_ids ?? []));
      setOptionalKeys(new Set(loaded.optional_keys ?? []));
      setManagerNotes(loaded.notes ?? "");

      const { data: tt } = await supabase
        .from("boarding_template_tasks")
        .select("*, tool:tools!boarding_template_tasks_assignee_tool_id_fkey(id, name)")
        .eq("template_id", loaded.template_id)
        .eq("is_active", true)
        .order("sort_order");
      const list = (tt ?? []) as unknown as BoardingTemplateTask[];
      setTemplateTasks(list);

      const toolIds = Array.from(new Set(list.filter((t) => t.assignee_tool_id).map((t) => t.assignee_tool_id as string)));
      if (toolIds.length) {
        const { data: owners } = await supabase
          .from("tool_owners")
          .select("tool_id, profile:profiles!tool_owners_profile_id_fkey(full_name), external:external_contacts!tool_owners_external_contact_id_fkey(full_name, company_name)")
          .in("tool_id", toolIds);
        type OwnerRow = { tool_id: string; profile: { full_name: string } | null; external: { full_name: string; company_name: string } | null };
        const map: Record<string, string[]> = {};
        for (const o of (owners ?? []) as unknown as OwnerRow[]) {
          const name = o.profile?.full_name ?? (o.external ? `${o.external.full_name} (${o.external.company_name})` : null);
          if (!name) continue;
          (map[o.tool_id] ||= []).push(name);
        }
        setToolOwners(map);
      }
    }
    setLoading(false);
  }

  const isManager = !!profileId && !!c && c.nearest_manager_id === profileId;
  const canAct = isStaff || isManager;
  // Staff och chef ser hela checklistan; övriga ser bara sina egna rader (RLS).
  const seesAllTasks = isStaff || isManager;
  // Personuppgifter i huvudet: staff, chef och Stab.
  const canSeePersonal = isStaff || isManager || isStab;

  const systemOptions = useMemo(() => {
    const seen = new Set<string>();
    return templateTasks
      .filter((t) => t.is_system_access && t.tool)
      .filter((t) => { const k = t.tool!.id; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((t) => ({ id: t.tool!.id, name: t.tool!.name, owners: toolOwners[t.tool!.id] ?? [] }));
  }, [templateTasks, toolOwners]);

  const optionalOptions = useMemo(() => {
    const seen = new Set<string>();
    return templateTasks
      .filter((t) => t.condition_key && !AUTO_CONDITION_KEYS.has(t.condition_key))
      .filter((t) => { if (seen.has(t.condition_key!)) return false; seen.add(t.condition_key!); return true; })
      .map((t) => ({ key: t.condition_key!, label: t.condition_label ?? t.title, title: t.title }));
  }, [templateTasks]);

  const autoNotes = useMemo(() => {
    if (!c) return [] as string[];
    const out: string[] = [];
    const keys = new Set(templateTasks.map((t) => t.condition_key));
    if (keys.has("location_stockholm")) {
      out.push((c.location ?? "").toLowerCase().includes("stockholm")
        ? "Placering i Stockholm → nycklar/passerkort läggs till automatiskt."
        : "Ingen Stockholmsplacering → nycklar/passerkort utelämnas automatiskt.");
    }
    if (keys.has("trigger_manual") && c.trigger_source !== "heartpace") {
      out.push("Ärendet kom inte från Heartpace → registrering i Heartpace läggs till som HR-uppgift.");
    }
    return out;
  }, [c, templateTasks]);

  // ---------------------------------------------------------- actions
  async function advance(body: Record<string, unknown>, okMessage: string) {
    if (!id) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("boarding-case-advance", { body: { caseId: id, ...body } });
    setBusy(false);
    if (error || data?.error) { toast.error(error?.message ?? data?.error); return; }
    toast.success(okMessage);
    load();
  }

  // Visa vilka som får vad innan något skickas. Samma logik som aktiveringen, utan skrivning.
  async function openPreview(action: "manager_submit" | "hr_confirm") {
    if (!id) return;
    setBusy(true);
    const body: Record<string, unknown> = { action: "preview", caseId: id };
    if (action === "manager_submit") {
      body.selectedToolIds = Array.from(selectedTools);
      body.optionalKeys = Array.from(optionalKeys);
    }
    const { data, error } = await supabase.functions.invoke("boarding-case-advance", { body });
    setBusy(false);
    if (error || data?.error) { toast.error(error?.message ?? data?.error); return; }
    setPreview(data as BoardingPreview);
    setPreviewAction(action);
  }

  async function confirmPreview() {
    if (!previewAction) return;
    const action = previewAction;
    setPreview(null);
    setPreviewAction(null);
    if (action === "manager_submit") {
      await advance(
        { action: "manager_submit", selectedToolIds: Array.from(selectedTools), optionalKeys: Array.from(optionalKeys), notes: managerNotes || null },
        c?.template?.require_hr_confirm ? "Dina val är skickade – HR bekräftar innan utskick" : "Uppgifter skapade och utskick gjort",
      );
    } else {
      await advance({ action: "hr_confirm" }, "Bekräftat – uppgifter skapade och utskick gjort");
    }
  }

  const managerSubmit = () => openPreview("manager_submit");
  const hrConfirm = () => openPreview("hr_confirm");
  const cancel = () => {
    if (!cancelReason.trim()) { toast.error("Ange anledning"); return; }
    advance({ action: "cancel", reason: cancelReason }, "Ärendet är avbrutet").then(() => setShowCancel(false));
  };

  async function toggleTask(task: BoardingCaseTask, status: TaskStatus, note?: string) {
    const { data, error } = await supabase.functions.invoke("boarding-task-checkoff", { body: { taskId: task.id, status, note } });
    if (error || data?.error) { toast.error(error?.message ?? data?.error); return; }
    if (data?.completed) toast.success("Sista uppgiften klar – ärendet är avslutat");
    load();
  }

  // ---------------------------------------------------------- render
  if (loading) return <p className="text-sm text-muted-foreground">Laddar...</p>;
  if (!c) return <p className="text-sm text-muted-foreground">Ärendet hittades inte, eller så har du inte behörighet att se det.</p>;

  const isOn = c.kind === "onboarding";
  const date = isOn ? c.start_date : c.last_day;
  const requireHr = c.template?.require_hr_confirm === true;
  const managerName = c.manager?.full_name ?? c.manager_name_raw ?? null;

  const grouped = groupTasks(tasks, profileId, myGroupNames);

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-up">
      <Button variant="ghost" size="sm" onClick={() => navigate("/boardingv2")}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Tillbaka
      </Button>

      {/* Huvudkort */}
      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {kindLabel(c.kind)} · {c.template?.name} · {TRIGGER_LABEL[c.trigger_source]}
            </p>
            <h1 className="text-2xl font-heading font-bold">{personName(c)}</h1>
            <p className="text-sm text-muted-foreground">
              {[c.title, c.department, c.location].filter(Boolean).join(" · ")}
            </p>
            <p className="text-sm text-muted-foreground">
              {date && `${isOn ? "Start" : "Sista dag"}: ${formatDate(date)}`}
              {managerName && ` · Chef: ${managerName}${!c.manager && c.manager_name_raw ? " (ej kopplad)" : ""}`}
              {!isOn && c.exit_reason && ` · ${EXIT_REASON_LABEL[c.exit_reason] ?? c.exit_reason}`}
            </p>
          </div>
          <Badge className={STATUS_CLASS[c.status]}>{STATUS_LABEL[c.status]}</Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Meta label="Arbetsmejl" value={c.work_email} />
          {canSeePersonal && <Meta label="Privat e-post" value={c.personal_email} />}
          {canSeePersonal && <Meta label="Kostnadsställe" value={c.cost_centre} />}
          {canSeePersonal && <Meta label="Anställningsform" value={c.employment_form} />}
        </div>

        <Timeline status={c.status} requireHr={requireHr} />
        {progress && progress.total > 0 && (c.status === "active" || c.status === "completed") && (
          <p className="text-xs text-muted-foreground">
            Hela ärendet: <span className="font-medium text-foreground">{progress.done} av {progress.total}</span> uppgifter klara
            {progress.pending > 0 ? ` · ${progress.pending} öppna` : ""}
          </p>
        )}

        {c.notes && c.status !== "awaiting_manager" && (
          <div className="text-sm bg-secondary/40 rounded p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Anteckningar</p>
            {c.notes}
          </div>
        )}
        {c.status === "cancelled" && c.cancel_reason && (
          <div className="text-sm bg-destructive/10 rounded p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div><p className="text-xs font-semibold text-destructive mb-1">Avbruten</p>{c.cancel_reason}</div>
          </div>
        )}
      </Card>

      {/* Chefens steg */}
      {c.status === "awaiting_manager" && (
        canAct ? (
          <Card className="p-5 space-y-5 border-warning/40">
            <div>
              <h2 className="font-heading font-bold text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-warning" /> {isManager ? "Dina val som närmaste chef" : "Chefens val"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isOn
                  ? "Välj vilka system personen ska ha tillgång till och kryssa i vad som är aktuellt. Varje val blir en uppgift till rätt ansvarig."
                  : "Markera vilka system personen har tillgång till så att rätt ansvariga kan stänga behörigheterna."}
                {!isManager && isStaff && " Du agerar som HR/admin åt chefen."}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Systembehörigheter</p>
              {!systemOptions.length && <p className="text-sm text-muted-foreground">Mallen har inga valbara system.</p>}
              <div className="grid sm:grid-cols-2 gap-1.5">
                {systemOptions.map((s) => (
                  <label key={s.id} className="flex items-start gap-2 rounded p-2 hover:bg-secondary/40 cursor-pointer">
                    <Checkbox
                      checked={selectedTools.has(s.id)}
                      onCheckedChange={(v) => setSelectedTools((prev) => toggleIn(prev, s.id, v === true))}
                      className="mt-0.5"
                    />
                    <span className="text-sm leading-tight">
                      {s.name}
                      {s.owners.length > 0 && <span className="block text-xs text-muted-foreground">→ {s.owners.join(", ")}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {optionalOptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Om aktuellt</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {optionalOptions.map((o) => (
                    <label key={o.key} className="flex items-start gap-2 rounded p-2 hover:bg-secondary/40 cursor-pointer">
                      <Checkbox
                        checked={optionalKeys.has(o.key)}
                        onCheckedChange={(v) => setOptionalKeys((prev) => toggleIn(prev, o.key, v === true))}
                        className="mt-0.5"
                      />
                      <span className="text-sm leading-tight">
                        {o.label}
                        {o.label !== o.title && <span className="block text-xs text-muted-foreground">{o.title}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {autoNotes.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                {autoNotes.map((n) => <p key={n} className="flex items-start gap-1.5"><Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />{n}</p>)}
              </div>
            )}

            {isOn && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Dator, mobil och tillbehör beställer du som vanligt under Beställningar → Ny beställning.
              </p>
            )}

            <div>
              <Label>Anteckningar till de ansvariga (valfritt)</Label>
              <Textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} rows={2} />
            </div>

            <Button onClick={managerSubmit} disabled={busy}>
              <Send className="h-4 w-4 mr-1.5" />
              {requireHr ? "Granska och skicka mina val till HR" : "Granska och skicka in"}
            </Button>
          </Card>
        ) : (
          <Card className="p-5 text-sm text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            Väntar på att {managerName ?? "närmaste chef"} gör sina val. Uppgifterna skapas och skickas ut därefter.
          </Card>
        )
      )}

      {/* HR-grind */}
      {c.status === "awaiting_hr" && (
        <Card className="p-5 space-y-4 border-warning/40">
          <div>
            <h2 className="font-heading font-bold text-lg flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-warning" /> HR bekräftar</h2>
            <p className="text-sm text-muted-foreground">
              {managerName ?? "Chefen"} skickade in sina val {formatDate(c.manager_submitted_at)}. Granska och starta utskicket.
            </p>
          </div>
          <ChoicesSummary c={c} systemOptions={systemOptions} optionalOptions={optionalOptions} />
          {isStaff ? (
            <Button onClick={hrConfirm} disabled={busy}><Play className="h-4 w-4 mr-1.5" /> Bekräfta & starta utskick</Button>
          ) : (
            <p className="text-sm text-muted-foreground">Bara HR, admin eller IT kan bekräfta.</p>
          )}
        </Card>
      )}

      {/* Valen som gjordes, efter aktivering */}
      {(c.status === "active" || c.status === "completed") && (systemOptions.length > 0 || optionalOptions.length > 0) && (
        <Card className="p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chefens val</p>
          <ChoicesSummary c={c} systemOptions={systemOptions} optionalOptions={optionalOptions} />
        </Card>
      )}

      {/* Uppgifter per ansvarig */}
      {tasks.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-heading font-bold text-lg">
            {seesAllTasks ? "Uppgifter" : "Dina uppgifter"} ({tasks.filter((t) => t.status !== "pending").length}/{tasks.length} klara)
          </h2>
          {!seesAllTasks && (
            <p className="text-xs text-muted-foreground -mt-2">Du ser de uppgifter som ligger på dig. Chef och HR ser hela checklistan.</p>
          )}
          {grouped.map(({ label, mine, list }) => (
            <Card key={label} className={`p-4 space-y-2 ${mine ? "border-primary/40" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                {list[0]?.assignee_group_name && <Users className="h-3.5 w-3.5" />}
                {label}{mine && <Badge variant="outline" className="text-[10px]">Dina</Badge>}
                <span className="font-normal normal-case tracking-normal">· {list.filter((t) => t.status !== "pending").length}/{list.length}</span>
              </p>
              <div className="space-y-1">
                {list.map((task) => {
                  const inGroup = !!task.assignee_group_name && myGroupNames.includes(task.assignee_group_name.toLowerCase());
                  const mayCheck = isStaff || isManager || inGroup || (!!profileId && task.assignee_profile_id === profileId);
                  const editable = mayCheck && c.status === "active";
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-2 rounded hover:bg-secondary/40">
                      <Button
                        size="sm"
                        variant={task.status === "done" ? "default" : "outline"}
                        className="h-7 w-7 p-0 mt-0.5"
                        disabled={!editable}
                        onClick={() => toggleTask(task, task.status === "done" ? "pending" : "done")}
                      >
                        {task.status === "done" ? <Check className="h-4 w-4" /> : task.status === "not_applicable" ? <RotateCcw className="h-3 w-3" /> : null}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.status !== "pending" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                        {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {task.category && <span>{task.category}</span>}
                          {task.deadline_date && ` · senast ${formatDate(task.deadline_date)}`}
                          {task.done_at && ` · ${task.status === "not_applicable" ? "ej aktuellt" : "klar"} ${formatDate(task.done_at)}`}
                        </p>
                        {task.note && <p className="text-xs italic text-muted-foreground mt-1">"{task.note}"</p>}
                      </div>
                      {editable && task.status === "pending" && (
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => toggleTask(task, "not_applicable", "Ej aktuellt")}>
                          Ej aktuellt
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Avbryt */}
      {canAct && c.status !== "completed" && c.status !== "cancelled" && (
        <Card className="p-4 space-y-2">
          <Button variant="outline" size="sm" onClick={() => setShowCancel((s) => !s)}>
            <X className="h-4 w-4 mr-1.5" /> Avbryt ärende
          </Button>
          {showCancel && (
            <div className="space-y-2 pt-2">
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Anledning till avbrytande" rows={2} />
              <Button variant="destructive" size="sm" onClick={cancel} disabled={busy}>Bekräfta avbrytande</Button>
            </div>
          )}
        </Card>
      )}

      {/* Förhandsvisning före utskick */}
      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) { setPreview(null); setPreviewAction(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {previewAction === "manager_submit" && requireHr ? "Dina val skickas till HR" : "Detta skickas nu"}
            </DialogTitle>
            <DialogDescription>
              {previewAction === "manager_submit" && requireHr
                ? "Inga uppgifter går ut än – HR granskar först. Så här ser listan ut med dina val:"
                : `${preview?.totalTasks ?? 0} uppgifter fördelade på ${preview?.recipients.length ?? 0} mottagare. Varje mottagare får ett samlat mejl.`}
            </DialogDescription>
          </DialogHeader>

          {preview?.redirect && (
            <div className="text-xs rounded border border-warning/40 bg-warning/10 p-2 flex items-start gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
              <span><strong>Testläge.</strong> Alla mejl omdirigeras till {preview.redirect}. Mottagarna nedan får ingenting.</span>
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto space-y-2 text-sm">
            {preview?.recipients.map((r) => (
              <div key={r.email} className="rounded border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {r.label}
                    {r.viaGroups.length > 0 && <span className="text-xs text-muted-foreground"> · via {r.viaGroups.join(", ")}</span>}
                  </span>
                  <Badge variant="outline">{r.count}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.email}</p>
                <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4">
                  {r.tasks.slice(0, 4).map((t) => <li key={t}>{t}</li>)}
                  {r.tasks.length > 4 && <li>… och {r.tasks.length - 4} till</li>}
                </ul>
              </div>
            ))}
            {preview && preview.recipients.length === 0 && (
              <p className="text-muted-foreground">Inga mottagare – inga uppgifter matchar valen.</p>
            )}
            {preview && preview.unassigned.length > 0 && (
              <div className="text-xs rounded border border-destructive/40 bg-destructive/10 p-2">
                <strong>Saknar ansvarig:</strong> {preview.unassigned.join(", ")}. Dessa skapas utan mottagare och måste tilldelas av HR.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPreview(null); setPreviewAction(null); }}>Avbryt</Button>
            <Button onClick={confirmPreview} disabled={busy}>
              <Send className="h-4 w-4 mr-1.5" />
              {previewAction === "manager_submit" && requireHr ? "Skicka till HR" : "Skicka"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mejllogg (staff) */}
      {isStaff && emailLog.length > 0 && (
        <Card className="p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Utskick</p>
          <div className="space-y-1 text-xs">
            {emailLog.map((e) => (
              <div key={e.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                <span className="text-foreground">{formatDate(e.sent_at)}</span>
                <span className="font-mono">{e.template_key}</span>
                <span>→ {e.recipient_email}</span>
                {e.redirected_from && <span className="text-warning">(omdirigerat från {e.redirected_from})</span>}
                {e.error && <span className="text-destructive">{e.error}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- helpers

function toggleIn(set: Set<string>, key: string, on: boolean) {
  const next = new Set(set);
  if (on) next.add(key); else next.delete(key);
  return next;
}

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}

function Timeline({ status, requireHr }: { status: CaseStatus; requireHr: boolean }) {
  const steps: { key: CaseStatus | "created"; label: string }[] = [
    { key: "created", label: "Skapat" },
    { key: "awaiting_manager", label: "Chefens val" },
    ...(requireHr ? [{ key: "awaiting_hr" as const, label: "HR bekräftar" }] : []),
    { key: "active", label: "Pågår" },
    { key: "completed", label: "Klart" },
  ];
  const order: (CaseStatus | "created")[] = ["created", "awaiting_manager", "awaiting_hr", "active", "completed"];
  const current = status === "cancelled" ? -1 : order.indexOf(status);
  return (
    <div className="flex items-center gap-1 text-xs flex-wrap">
      {steps.map((s, i) => {
        const idx = order.indexOf(s.key);
        const done = current > idx;
        const active = current === idx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <span className={`rounded-full px-2 py-0.5 ${done ? "bg-primary/20 text-primary" : active ? "bg-warning/20 text-warning font-semibold" : "bg-muted text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="text-muted-foreground">›</span>}
          </div>
        );
      })}
      {status === "cancelled" && <span className="rounded-full px-2 py-0.5 bg-destructive/20 text-destructive">Avbruten</span>}
    </div>
  );
}

function ChoicesSummary({
  c, systemOptions, optionalOptions,
}: {
  c: BoardingCase;
  systemOptions: { id: string; name: string }[];
  optionalOptions: { key: string; label: string }[];
}) {
  const systems = systemOptions.filter((s) => c.selected_tool_ids.includes(s.id)).map((s) => s.name);
  const optionals = optionalOptions.filter((o) => c.optional_keys.includes(o.key)).map((o) => o.label);
  return (
    <div className="text-sm space-y-1">
      <p><span className="text-muted-foreground">System:</span> {systems.length ? systems.join(", ") : "inga valda"}</p>
      <p><span className="text-muted-foreground">Om aktuellt:</span> {optionals.length ? optionals.join(", ") : "inget markerat"}</p>
      {c.notes && <p><span className="text-muted-foreground">Anteckning:</span> {c.notes}</p>}
    </div>
  );
}

function groupTasks(tasks: BoardingCaseTask[], profileId: string | null, myGroupNames: string[]) {
  const map = new Map<string, { label: string; mine: boolean; list: BoardingCaseTask[] }>();
  for (const t of tasks) {
    const label = t.assignee?.full_name || t.assignee_label || UNASSIGNED;
    const mine = (!!profileId && t.assignee_profile_id === profileId)
      || (!!t.assignee_group_name && myGroupNames.includes(t.assignee_group_name.toLowerCase()));
    if (!map.has(label)) map.set(label, { label, mine, list: [] });
    map.get(label)!.list.push(t);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.mine !== b.mine) return a.mine ? -1 : 1;
    if ((a.label === UNASSIGNED) !== (b.label === UNASSIGNED)) return a.label === UNASSIGNED ? 1 : -1;
    return a.label.localeCompare(b.label, "sv");
  });
}
