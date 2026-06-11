import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, UserPlus, UserMinus, Clock, CheckCircle2, XCircle } from "lucide-react";

type Kind = "onboarding" | "offboarding";

interface Instance {
  id: string;
  status: string;
  start_date: string | null;
  last_day: string | null;
  prospective_name: string | null;
  template: { kind: Kind; name: string } | null;
  profile: { full_name: string } | null;
  manager: { full_name: string } | null;
}

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_hr: "bg-warning/20 text-warning",
  active: "bg-accent/20 text-accent",
  completed: "bg-primary/20 text-primary",
  cancelled: "bg-destructive/20 text-destructive",
};

const statusLabel: Record<string, string> = {
  draft: "Utkast",
  pending_hr: "Väntar HR",
  active: "Pågående",
  completed: "Klar",
  cancelled: "Avbruten",
};

export default function Boarding() {
  const [kind, setKind] = useState<Kind>("onboarding");
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { load(); }, [kind]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("onboarding_instances")
      .select("id, status, start_date, last_day, prospective_name, template:onboarding_templates!inner(kind, name), profile:profiles!onboarding_instances_profile_id_fkey(full_name), manager:profiles!onboarding_instances_nearest_manager_id_fkey(full_name)")
      .eq("onboarding_templates.kind", kind)
      .order("created_at", { ascending: false });
    setInstances((data ?? []) as any);
    setLoading(false);
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">On- och offboarding</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Översikt av pågående och avslutade processer.</p>
        </div>
        <Button onClick={() => navigate(`/boarding/ny?kind=${kind}`)}>
          <Plus className="h-4 w-4 mr-1.5" /> Ny {kind === "onboarding" ? "onboarding" : "offboarding"}
        </Button>
      </div>

      <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
        <TabsList>
          <TabsTrigger value="onboarding"><UserPlus className="h-4 w-4 mr-1.5" /> Onboarding</TabsTrigger>
          <TabsTrigger value="offboarding"><UserMinus className="h-4 w-4 mr-1.5" /> Offboarding</TabsTrigger>
        </TabsList>

        <TabsContent value={kind} className="mt-4 space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Laddar...</p>}
          {!loading && !instances.length && (
            <Card className="p-8 text-center text-muted-foreground">Inga {kind === "onboarding" ? "onboardings" : "offboardings"} än.</Card>
          )}
          {instances.map(inst => {
            const name = inst.profile?.full_name || inst.prospective_name || "(Namn saknas)";
            const date = kind === "onboarding" ? inst.start_date : inst.last_day;
            return (
              <Link key={inst.id} to={`/boarding/${inst.id}`}>
                <Card className="p-4 hover:bg-secondary/40 transition-colors">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      {inst.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-primary" /> :
                       inst.status === "cancelled" ? <XCircle className="h-5 w-5 text-destructive" /> :
                       <Clock className="h-5 w-5 text-accent" />}
                      <div>
                        <p className="font-semibold">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {inst.template?.name}
                          {date ? ` · ${kind === "onboarding" ? "Start" : "Sista dag"} ${date}` : ""}
                          {inst.manager?.full_name ? ` · Chef: ${inst.manager.full_name}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge className={statusColor[inst.status]}>{statusLabel[inst.status]}</Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
