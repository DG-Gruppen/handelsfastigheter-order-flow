import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, UserPlus, UserMinus, Clock, CheckCircle2, XCircle, FlaskConical, Info } from "lucide-react";
import { useBoardingAccess } from "./useBoardingAccess";
import {
  type BoardingCase, type BoardingKind, type CaseStatus,
  STATUS_CLASS, STATUS_LABEL, personName, formatDate,
} from "./boardingV2";

type Filter = "open" | "all";

export default function BoardingV2List() {
  const navigate = useNavigate();
  const { isStaff, isManagerGroup } = useBoardingAccess();
  const [kind, setKind] = useState<BoardingKind>("onboarding");
  const [filter, setFilter] = useState<Filter>("open");
  const [cases, setCases] = useState<BoardingCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [kind]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("boarding_cases")
      .select("*, template:boarding_templates(id, kind, name, description, is_default, require_hr_confirm), manager:profiles!boarding_cases_nearest_manager_id_fkey(id, full_name, email)")
      .eq("kind", kind)
      .order("created_at", { ascending: false });
    setCases((data ?? []) as unknown as BoardingCase[]);
    setLoading(false);
  }

  const visible = useMemo(
    () => cases.filter((c) => filter === "all" || (c.status !== "completed" && c.status !== "cancelled")),
    [cases, filter],
  );

  const counts = useMemo(() => {
    const m: Partial<Record<CaseStatus, number>> = {};
    for (const c of cases) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [cases]);

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">On- och offboarding</h1>
            <Badge variant="outline" className="gap-1"><FlaskConical className="h-3 w-3" /> v2</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Heartpace först, chefen väljer system, ansvariga får sina uppgifter. Byggs vid sidan av nuvarande flöde.
          </p>
        </div>
        {(isStaff || isManagerGroup) && (
          <Button onClick={() => navigate(`/boardingv2/ny?kind=${kind}`)}>
            <Plus className="h-4 w-4 mr-1.5" /> Nytt ärende
          </Button>
        )}
      </div>

      <Tabs value={kind} onValueChange={(v) => setKind(v as BoardingKind)}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="onboarding"><UserPlus className="h-4 w-4 mr-1.5" /> Onboarding</TabsTrigger>
            <TabsTrigger value="offboarding"><UserMinus className="h-4 w-4 mr-1.5" /> Offboarding</TabsTrigger>
          </TabsList>
          <div className="flex gap-1">
            <Button size="sm" variant={filter === "open" ? "secondary" : "ghost"} onClick={() => setFilter("open")}>
              Pågående
            </Button>
            <Button size="sm" variant={filter === "all" ? "secondary" : "ghost"} onClick={() => setFilter("all")}>
              Alla ({cases.length})
            </Button>
          </div>
        </div>

        <TabsContent value={kind} className="mt-4 space-y-2">
          {!loading && cases.length > 0 && (
            <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
              {(Object.keys(STATUS_LABEL) as CaseStatus[]).filter((s) => counts[s]).map((s) => (
                <span key={s} className={`rounded px-2 py-0.5 ${STATUS_CLASS[s]}`}>
                  {STATUS_LABEL[s]}: {counts[s]}
                </span>
              ))}
            </div>
          )}
          {loading && <p className="text-sm text-muted-foreground">Laddar...</p>}
          {!loading && !visible.length && (
            <Card className="p-8 text-center text-muted-foreground text-sm space-y-2">
              <Info className="h-5 w-5 mx-auto opacity-60" />
              <p>Inga {filter === "open" ? "pågående " : ""}{kind === "onboarding" ? "onboardings" : "offboardings"} i v2 än.</p>
              {(isStaff || isManagerGroup) && (
                <p>Skapa ett ärende manuellt eller simulera en Heartpace-post via <strong>Nytt ärende</strong>.</p>
              )}
            </Card>
          )}
          {visible.map((c) => {
            const date = kind === "onboarding" ? c.start_date : c.last_day;
            return (
              <Link key={c.id} to={`/boardingv2/${c.id}`}>
                <Card className="p-4 hover:bg-secondary/40 transition-colors">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      {c.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-primary" /> :
                       c.status === "cancelled" ? <XCircle className="h-5 w-5 text-destructive" /> :
                       <Clock className="h-5 w-5 text-accent" />}
                      <div>
                        <p className="font-semibold">{personName(c)}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.title ? `${c.title} · ` : ""}
                          {c.department ? `${c.department} · ` : ""}
                          {date ? `${kind === "onboarding" ? "Start" : "Sista dag"} ${formatDate(date)}` : ""}
                          {c.manager?.full_name ? ` · Chef: ${c.manager.full_name}` : c.manager_name_raw ? ` · Chef (ej kopplad): ${c.manager_name_raw}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.trigger_source !== "heartpace" && (
                        <Badge variant="outline" className="text-[10px]">
                          {c.trigger_source === "simulated" ? "Simulerad" : "Manuell"}
                        </Badge>
                      )}
                      <Badge className={STATUS_CLASS[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    </div>
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
