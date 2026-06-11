import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Save, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type Kind = "onboarding" | "offboarding";
type Source = "static_profile" | "tool_owner" | "area_owner" | "role" | "nearest_manager";

interface Template { id: string; kind: Kind; name: string; description: string | null; is_active: boolean; is_default: boolean; }
interface TemplateTask {
  id: string;
  template_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  category: string | null;
  conditional: string;
  due_offset_days: number;
  assignee_source: Source;
  assignee_profile_id: string | null;
  assignee_tool_id: string | null;
  assignee_area_id: string | null;
  assignee_role: string | null;
  is_active: boolean;
}

export default function BoardingTemplatesManager() {
  const [kind, setKind] = useState<Kind>("onboarding");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const [tools, setTools] = useState<{ id: string; name: string }[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadTemplates(); loadRefs(); }, [kind]);
  useEffect(() => { if (activeId) loadTasks(activeId); else setTasks([]); }, [activeId]);

  async function loadTemplates() {
    const { data } = await supabase.from("onboarding_templates").select("*").eq("kind", kind).order("name");
    setTemplates((data ?? []) as Template[]);
    if (data && data.length && !activeId) setActiveId(data[0].id);
    if (data && !data.find(d => d.id === activeId)) setActiveId(data?.[0]?.id ?? null);
  }
  async function loadRefs() {
    const [t, a, p] = await Promise.all([
      supabase.from("tools").select("id, name").eq("is_active", true).order("name"),
      supabase.from("responsibility_areas").select("id, name").order("name"),
      supabase.from("profiles").select("id, full_name").eq("is_hidden", false).order("full_name"),
    ]);
    setTools((t.data ?? []) as any);
    setAreas((a.data ?? []) as any);
    setProfiles((p.data ?? []) as any);
  }
  async function loadTasks(templateId: string) {
    setLoading(true);
    const { data } = await supabase
      .from("onboarding_template_tasks")
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order");
    setTasks((data ?? []) as TemplateTask[]);
    setLoading(false);
  }

  async function createTemplate() {
    const name = prompt(`Namn på ny ${kind === "onboarding" ? "onboarding" : "offboarding"}-mall?`);
    if (!name) return;
    const { data, error } = await supabase
      .from("onboarding_templates")
      .insert({ kind, name })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success("Mall skapad");
    await loadTemplates();
    setActiveId(data.id);
  }
  async function updateTemplate(t: Template, patch: Partial<Template>) {
    await supabase.from("onboarding_templates").update(patch).eq("id", t.id);
    loadTemplates();
  }
  async function deleteTemplate(id: string) {
    if (!confirm("Radera mallen och alla dess uppgifter?")) return;
    await supabase.from("onboarding_templates").delete().eq("id", id);
    setActiveId(null);
    loadTemplates();
  }

  async function addTask() {
    if (!activeId) return;
    const sort = Math.max(0, ...tasks.map(t => t.sort_order)) + 1;
    const { error } = await supabase.from("onboarding_template_tasks").insert({
      template_id: activeId,
      sort_order: sort,
      title: "Ny uppgift",
      assignee_source: "nearest_manager",
    });
    if (error) toast.error(error.message); else loadTasks(activeId);
  }
  async function updateTask(task: TemplateTask, patch: Partial<TemplateTask>) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...patch } : t));
    const { error } = await supabase.from("onboarding_template_tasks").update(patch).eq("id", task.id);
    if (error) { toast.error(error.message); loadTasks(activeId!); }
  }
  async function removeTask(id: string) {
    await supabase.from("onboarding_template_tasks").delete().eq("id", id);
    loadTasks(activeId!);
  }
  async function moveTask(task: TemplateTask, dir: -1 | 1) {
    const idx = tasks.findIndex(t => t.id === task.id);
    const swap = tasks[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("onboarding_template_tasks").update({ sort_order: swap.sort_order }).eq("id", task.id),
      supabase.from("onboarding_template_tasks").update({ sort_order: task.sort_order }).eq("id", swap.id),
    ]);
    loadTasks(activeId!);
  }

  const active = templates.find(t => t.id === activeId);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-heading font-bold">On-/Offboarding-mallar</h2>
        <p className="text-sm text-muted-foreground">Hantera vad som ska göras, av vem och när — utan att röra koden.</p>
      </div>

      <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
        <TabsList>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="offboarding">Offboarding</TabsTrigger>
        </TabsList>

        <TabsContent value={kind} className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
            <Card className="p-3 space-y-2">
              <Button onClick={createTemplate} variant="outline" size="sm" className="w-full justify-start">
                <Plus className="h-4 w-4 mr-2" /> Ny mall
              </Button>
              <div className="space-y-1">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${activeId === t.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}
                  >
                    {t.name}
                    {t.is_default && <span className="text-[10px] ml-2 text-accent">DEFAULT</span>}
                  </button>
                ))}
                {!templates.length && <p className="text-xs text-muted-foreground px-2 py-4">Inga mallar än.</p>}
              </div>
            </Card>

            <div className="space-y-4">
              {active ? (
                <>
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={active.name}
                        onChange={(e) => updateTemplate(active, { name: e.target.value })}
                        className="font-semibold"
                      />
                      <Button variant="ghost" size="sm" onClick={() => deleteTemplate(active.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Beskrivning"
                      value={active.description ?? ""}
                      onChange={(e) => updateTemplate(active, { description: e.target.value })}
                      rows={2}
                    />
                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={active.is_active} onChange={(e) => updateTemplate(active, { is_active: e.target.checked })} />
                        Aktiv
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={active.is_default} onChange={(e) => updateTemplate(active, { is_default: e.target.checked })} />
                        Standardmall
                      </label>
                    </div>
                  </Card>

                  <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Uppgifter ({tasks.length})</h3>
                      <Button onClick={addTask} size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Lägg till</Button>
                    </div>
                    {loading && <p className="text-sm text-muted-foreground">Laddar...</p>}
                    <div className="space-y-2">
                      {tasks.map((task, i) => (
                        <div key={task.id} className="border rounded p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="flex flex-col">
                              <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => moveTask(task, -1)} className="h-5 px-1"><ChevronUp className="h-3 w-3" /></Button>
                              <Button size="sm" variant="ghost" disabled={i === tasks.length - 1} onClick={() => moveTask(task, 1)} className="h-5 px-1"><ChevronDown className="h-3 w-3" /></Button>
                            </div>
                            <div className="flex-1 space-y-2">
                              <Input
                                value={task.title}
                                onChange={(e) => updateTask(task, { title: e.target.value })}
                                placeholder="Titel"
                                className="font-medium"
                              />
                              <Textarea
                                value={task.description ?? ""}
                                onChange={(e) => updateTask(task, { description: e.target.value })}
                                placeholder="Beskrivning (visas i mejl)"
                                rows={2}
                              />
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div>
                                  <Label className="text-xs">Kategori</Label>
                                  <Input value={task.category ?? ""} onChange={(e) => updateTask(task, { category: e.target.value })} placeholder="hr / system / hardware..." />
                                </div>
                                <div>
                                  <Label className="text-xs">Offset (dagar)</Label>
                                  <Input type="number" value={task.due_offset_days} onChange={(e) => updateTask(task, { due_offset_days: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div>
                                  <Label className="text-xs">Villkor</Label>
                                  <Input value={task.conditional} onChange={(e) => updateTask(task, { conditional: e.target.value })} placeholder="always / if_company_car..." />
                                </div>
                                <div>
                                  <Label className="text-xs">Ansvarig hämtas från</Label>
                                  <Select value={task.assignee_source} onValueChange={(v) => updateTask(task, { assignee_source: v as Source })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="nearest_manager">Närmaste chef</SelectItem>
                                      <SelectItem value="tool_owner">Verktygsägare</SelectItem>
                                      <SelectItem value="area_owner">Ansvarsområde</SelectItem>
                                      <SelectItem value="role">Roll (grupp)</SelectItem>
                                      <SelectItem value="static_profile">Specifik person</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {task.assignee_source === "tool_owner" && (
                                <Select value={task.assignee_tool_id ?? ""} onValueChange={(v) => updateTask(task, { assignee_tool_id: v })}>
                                  <SelectTrigger><SelectValue placeholder="Välj verktyg" /></SelectTrigger>
                                  <SelectContent>
                                    {tools.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                              {task.assignee_source === "area_owner" && (
                                <Select value={task.assignee_area_id ?? ""} onValueChange={(v) => updateTask(task, { assignee_area_id: v })}>
                                  <SelectTrigger><SelectValue placeholder="Välj ansvarsområde" /></SelectTrigger>
                                  <SelectContent>
                                    {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                              {task.assignee_source === "static_profile" && (
                                <Select value={task.assignee_profile_id ?? ""} onValueChange={(v) => updateTask(task, { assignee_profile_id: v })}>
                                  <SelectTrigger><SelectValue placeholder="Välj person" /></SelectTrigger>
                                  <SelectContent>
                                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                              {task.assignee_source === "role" && (
                                <Input value={task.assignee_role ?? ""} onChange={(e) => updateTask(task, { assignee_role: e.target.value })} placeholder="t.ex. hr, it" />
                              )}
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removeTask(task.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                      {!tasks.length && !loading && <p className="text-sm text-muted-foreground py-4 text-center">Inga uppgifter än. Klicka "Lägg till".</p>}
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="p-8 text-center text-muted-foreground">
                  Välj eller skapa en mall.
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
