import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { UserPlus, Copy, ExternalLink, Trash2, CheckCircle2, Clock, XCircle, Building2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface ExternalInvite {
  id: string;
  email: string;
  token: string;
  company_name: string;
  module_slugs: string[];
  group_ids: string[];
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface ExternalProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export default function ExternalPartiesManager() {
  const { user } = useAuth();
  const { modules } = useModules();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // Fetch invites
  const { data: invites = [] } = useQuery({
    queryKey: ["external-invites"],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_invites")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as ExternalInvite[];
    },
  });

  // Fetch external profiles
  const { data: externalProfiles = [] } = useQuery({
    queryKey: ["external-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, created_at")
        .eq("is_external", true)
        .order("created_at", { ascending: false });
      return (data ?? []) as ExternalProfile[];
    },
  });

  // Modules that make sense for external users (exclude admin-only modules)
  const externalModules = modules.filter(
    (m) => m.is_active && !["admin", "home"].includes(m.slug)
  );

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!newEmail.trim()) throw new Error("E-post krävs");
      if (!user) throw new Error("Ej inloggad");

      const { error } = await supabase.from("external_invites").insert({
        email: newEmail.trim().toLowerCase(),
        company_name: newCompany.trim(),
        invited_by: user.id,
        module_slugs: selectedModules,
        group_ids: [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inbjudan skapad!");
      queryClient.invalidateQueries({ queryKey: ["external-invites"] });
      setInviteOpen(false);
      setNewEmail("");
      setNewCompany("");
      setSelectedModules([]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("external_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inbjudan borttagen");
      queryClient.invalidateQueries({ queryKey: ["external-invites"] });
    },
  });

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/extern/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Inbjudningslänk kopierad!");
  };

  const toggleModule = (slug: string) => {
    setSelectedModules((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-accent" />
            Externa parter
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bjud in externa partners och hantera deras åtkomst
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-accent to-accent/80 hover:opacity-90">
              <UserPlus className="h-4 w-4" />
              Bjud in
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Bjud in extern partner</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>E-post</Label>
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="namn@foretag.se"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <Label>Företagsnamn</Label>
                <Input
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Företaget AB"
                />
              </div>
              <div className="space-y-2">
                <Label>Modulåtkomst (läsbehörighet)</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {externalModules.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedModules.includes(m.slug)}
                        onCheckedChange={() => toggleModule(m.slug)}
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Avbryt</Button>
              </DialogClose>
              <Button
                onClick={() => createInvite.mutate()}
                disabled={createInvite.isPending || !newEmail.trim()}
                className="bg-gradient-to-r from-accent to-accent/80 hover:opacity-90"
              >
                Skapa inbjudan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active external users */}
      {externalProfiles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aktiva externa användare</CardTitle>
            <CardDescription>{externalProfiles.length} externa konton</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {externalProfiles.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <Badge variant="outline" className="text-accent border-accent/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Aktiv
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invites */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inbjudningar</CardTitle>
          <CardDescription>
            Skapa en inbjudan och skicka länken till den externa parten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Inga inbjudningar ännu
            </p>
          ) : (
            <div className="divide-y">
              {invites.map((inv) => {
                const isExpired = new Date(inv.expires_at) < new Date();
                const isAccepted = !!inv.accepted_at;

                return (
                  <div key={inv.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{inv.email}</p>
                        {inv.company_name && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {inv.company_name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isAccepted ? (
                          <Badge variant="outline" className="text-accent border-accent/30 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Accepterad
                          </Badge>
                        ) : isExpired ? (
                          <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Utgången
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Väntar
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(inv.created_at), "d MMM yyyy", { locale: sv })}
                        </span>
                        {inv.module_slugs?.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · {inv.module_slugs.length} moduler
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isAccepted && !isExpired && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyInviteLink(inv.token)}
                          title="Kopiera inbjudningslänk"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteInvite.mutate(inv.id)}
                        title="Ta bort"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
