import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Check, X, Play, AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Instance {
  id: string;
  status: string;
  start_date: string | null;
  last_day: string | null;
  exit_reason: string | null;
  exit_type: string | null;
  prospective_name: string | null;
  prospective_title: string | null;
  notes: string | null;
  cancel_reason: string | null;
  template: { kind: "onboarding" | "offboarding"; name: string };
  profile: { full_name: string; email: string } | null;
  manager: { full_name: string } | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  deadline_date: string | null;
  status: "pending" | "done" | "not_applicable";
  done_at: string | null;
  note: string | null;
  assignee_label: string | null;
  assignee_profile_id: string | null;
  assignee: { full_name: string; email: string } | null;
}

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_hr: "bg-warning/20 text-warning",
  active: "bg-accent/20 text-accent",
  completed: "bg-primary/20 text-primary",
  cancelled: "bg-destructive/20 text-destructive",
};

export default function BoardingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inst, setInst] = useState<Instance | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [i, t] = await Promise.all([
      supabase
        .from("onboarding_instances")
        .select("*, template:onboarding_templates(kind, name), profile:profiles!onboarding_instances_profile_id_fkey(full_name, email), manager:profiles!onboarding_instances_nearest_manager_id_fkey(full_name)")
        .eq("id", id).single(),
      supabase
        .from("onboarding_tasks")
        .select("*, assignee:profiles!onboarding_tasks_assignee_profile_id_fkey(full_name, email)")
        .eq("instance_id", id)
        .order("sort_order"),
    ]);
    setInst(i.data as any);
    setTasks((t.data ?? []) as any);
    setLoading(false);
  }

  async function confirm() {
    if (!id) return;
    const { error } = await supabase.functions.invoke("onboarding-hr-confirm", { body: { instanceId: id } });
    if (error) { toast.error(error.message); return; }
    toast.success("Uppgifter skapade och utskick startat");
    load();
  }
  async function toggleTask(task: Task, status: "done" | "pending" | "not_applicable", note?: string) {
    const { error } = await supabase.functions.invoke("onboarding-task-checkoff", {
      body: { taskId: task.id, status, note },
    });
    if (error) { toast.error(error.message); return; }
    load();
  }
  async function cancel() {
    if (!id || !cancelReason.trim()) { toast.error("Ange anledning"); return; }
    const { error } = await supabase.functions.invoke("onboarding-cancel", {
      body: { instanceId: id, reason: cancelReason },
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Avbruten");
    setShowCancel(false);
    load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Laddar...</p>;
  if (!inst) return <p className="text-sm text-muted-foreground">Ärende hittades inte.</p>;

  const kind = inst.template.kind;
  const name = inst.profile?.full_name || inst.prospective_name || "(Namn saknas)";
  const date = kind === "onboarding" ? inst.start_date : inst.last_day;
  const dateLabel = kind === "onboarding" ? "Start" : "Sista dag";

  const grouped = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    const k = t.category || "Övrigt";
    (acc[k] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-up">
      <Button variant="ghost" size="sm" onClick={() => navigate("/boarding")}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Tillbaka
      </Button>

      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {kind === "onboarding" ? "Onboarding" : "Offboarding"} · {inst.template.name}
            </p>
            <h1 className="text-2xl font-heading font-bold">{name}</h1>
            <p className="text-sm text-muted-foreground">
              {inst.prospective_title && `${inst.prospective_title} · `}
              {date && `${dateLabel}: ${date}`}
              {inst.manager?.full_name && ` · Chef: ${inst.manager.full_name}`}
            </p>
          </div>
          <Badge className={statusColor[inst.status]}>{inst.status}</Badge>
        </div>

        {inst.notes && (
          <div className="text-sm bg-secondary/40 rounded p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Anteckningar</p>
            {inst.notes}
          </div>
        )}

        {inst.status === "cancelled" && inst.cancel_reason && (
          <div className="text-sm bg-destructive/10 rounded p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-destructive mb-1">Avbruten</p>
              {inst.cancel_reason}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(inst.status === "draft" || inst.status === "pending_hr") && (
            <Button onClick={confirm}>
              <Play className="h-4 w-4 mr-1.5" /> Bekräfta & starta utskick
            </Button>
          )}
          {inst.status !== "cancelled" && inst.status !== "completed" && (
            <Button variant="outline" onClick={() => setShowCancel(s => !s)}>
              <X className="h-4 w-4 mr-1.5" /> Avbryt ärende
            </Button>
          )}
        </div>

        {showCancel && (
          <div className="space-y-2 border-t pt-3">
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Anledning till avbrytande" rows={2} />
            <Button variant="destructive" size="sm" onClick={cancel}>Bekräfta avbrytande</Button>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <h2 className="font-heading font-bold text-lg">Uppgifter ({tasks.length})</h2>
        {!tasks.length && (
          <Card className="p-6 text-center text-muted-foreground text-sm">
            Inga uppgifter än. Klicka "Bekräfta & starta utskick" för att skapa dem från mallen.
          </Card>
        )}
        {Object.entries(grouped).map(([cat, list]) => (
          <Card key={cat} className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
            <div className="space-y-2">
              {list.map(task => (
                <div key={task.id} className="flex items-start gap-3 p-2 rounded hover:bg-secondary/40">
                  <Button
                    size="sm"
                    variant={task.status === "done" ? "default" : "outline"}
                    className="h-7 w-7 p-0 mt-0.5"
                    onClick={() => toggleTask(task, task.status === "done" ? "pending" : "done")}
                  >
                    {task.status === "done" ? <Check className="h-4 w-4" /> : task.status === "not_applicable" ? <RotateCcw className="h-3 w-3" /> : null}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                    {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">{task.assignee?.full_name || task.assignee_label || "(ej tilldelad)"}</span>
                      {task.deadline_date && ` · senast ${task.deadline_date}`}
                      {task.done_at && ` · klar ${new Date(task.done_at).toLocaleDateString("sv-SE")}`}
                    </p>
                    {task.note && <p className="text-xs italic text-muted-foreground mt-1">"{task.note}"</p>}
                  </div>
                  {task.status !== "not_applicable" && task.status !== "done" && (
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => toggleTask(task, "not_applicable", "Ej aktuellt")}>
                      Ej aktuellt
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
