import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavSettings } from "@/hooks/useNavSettings";
import { useAuth } from "@/hooks/useAuth";
import { useModulePermission } from "@/hooks/useModulePermission";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Clock, ExternalLink, HelpCircle, Headphones, Settings, Check } from "lucide-react";
import { toast } from "sonner";
import FaqManager from "@/components/FaqManager";
import PwaInstallGuide from "@/components/PwaInstallGuide";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

export default function ITInfo() {
  const { settings, refresh } = useNavSettings();
  const { roles } = useAuth();
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [managingFaq, setManagingFaq] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editingRemoteHelp, setEditingRemoteHelp] = useState(false);
  const isItOrAdmin = roles.includes("admin") || roles.includes("it");

  // Local edit state for contact
  const [contactForm, setContactForm] = useState({ email: "", phone: "", hours: "" });
  // Local edit state for remote help
  const [remoteForm, setRemoteForm] = useState({ label: "", url: "", visible: true });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFaq = useCallback(async () => {
    const { data } = await supabase
      .from("it_faq")
      .select("id, question, answer, sort_order")
      .eq("is_active", true)
      .order("sort_order");
    setFaq((data as FaqItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFaq();

    const channel = supabase
      .channel("itinfo-faq")
      .on("postgres_changes", { event: "*", schema: "public", table: "it_faq" }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => loadFaq(), 500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadFaq]);

  const remoteHelpUrl = settings["it_remote_help_url"] || "https://my.splashtop.eu/sos/packages/download/37PXZW4LPWXTEU";
  const remoteHelpLabel = settings["it_remote_help_label"] || "Fjärrhjälp (Splashtop)";
  const showRemoteHelp = settings["it_remote_help_visible"] !== "false";

  const contactEmail = settings["it_contact_email"] || "helpdesk@dggruppen.se";
  const contactPhone = settings["it_contact_phone"] || "08 - 72 17 222 -> tryck 1";
  const contactHours = settings["it_contact_hours"] || "Mån – Fre | 08:00 – 17:00";

  const upsertSetting = async (key: string, value: string) => {
    await supabase
      .from("org_chart_settings")
      .upsert(
        { setting_key: key, setting_value: value, updated_at: new Date().toISOString() } as any,
        { onConflict: "setting_key" }
      );
  };

  const startEditingContact = () => {
    setContactForm({
      email: contactEmail,
      phone: contactPhone,
      hours: contactHours,
    });
    setEditingContact(true);
  };

  const saveContact = async () => {
    await Promise.all([
      upsertSetting("it_contact_email", contactForm.email),
      upsertSetting("it_contact_phone", contactForm.phone),
      upsertSetting("it_contact_hours", contactForm.hours),
    ]);
    toast.success("Kontaktuppgifter uppdaterade");
    setEditingContact(false);
    refresh();
  };

  const startEditingRemoteHelp = () => {
    setRemoteForm({
      label: remoteHelpLabel,
      url: remoteHelpUrl,
      visible: showRemoteHelp,
    });
    setEditingRemoteHelp(true);
  };

  const saveRemoteHelp = async () => {
    await Promise.all([
      upsertSetting("it_remote_help_label", remoteForm.label),
      upsertSetting("it_remote_help_url", remoteForm.url),
      upsertSetting("it_remote_help_visible", remoteForm.visible ? "true" : "false"),
    ]);
    toast.success("Fjärrhjälp uppdaterad");
    setEditingRemoteHelp(false);
    refresh();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 md:space-y-6 animate-fade-up">
      <div>
        <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">IT-support</h1>
        <p className="text-sm text-muted-foreground mt-1">Kontakta IT-avdelningen eller hitta svar på vanliga frågor</p>
      </div>

      {/* Contact info */}
      <Card className="glass-card border-t-2 border-t-primary/40">
        <CardHeader className="px-4 md:px-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shadow-sm shadow-primary/10">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="font-heading text-base md:text-lg text-primary">Kontakta IT</CardTitle>
              <CardDescription className="text-xs">Behöver du hjälp? Kontakta oss via något av sätten nedan</CardDescription>
            </div>
            {isItOrAdmin && !editingContact && (
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground" onClick={startEditingContact}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {isItOrAdmin && editingContact && (
              <Button variant="ghost" size="icon" className="h-10 w-10 text-primary hover:text-primary/80 hover:bg-primary/10" onClick={saveContact}>
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          {editingContact ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">E-post</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full min-h-0 h-10 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Telefon & växel</label>
                <input
                  type="text"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full min-h-0 h-10 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Öppettider</label>
                <input
                  type="text"
                  value={contactForm.hours}
                  onChange={(e) => setContactForm((p) => ({ ...p, hours: e.target.value }))}
                  className="w-full min-h-0 h-10 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">E-post</p>
                  <a href={`mailto:${contactEmail}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                    {contactEmail}
                  </a>
                </div>
              </div>
              {contactPhone && (
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/20 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Telefon</p>
                    <a href={`tel:${contactPhone.replace(/\D/g, "")}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                      {contactPhone}
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Öppettider</p>
                  <p className="text-sm font-medium text-foreground">{contactHours}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remote help */}
      {(showRemoteHelp || editingRemoteHelp) && (
        <Card className="glass-card border-t-2 border-t-warning/40">
          <CardContent className="px-4 md:px-6 py-5">
            {editingRemoteHelp ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 shadow-sm shadow-warning/10">
                      <ExternalLink className="h-5 w-5 text-warning" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Redigera fjärrhjälp</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-primary hover:text-primary/80 hover:bg-primary/10" onClick={saveRemoteHelp}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Länktext</label>
                  <input
                    type="text"
                    value={remoteForm.label}
                    onChange={(e) => setRemoteForm((p) => ({ ...p, label: e.target.value }))}
                    className="w-full min-h-0 h-10 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-warning/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">URL</label>
                  <input
                    type="url"
                    value={remoteForm.url}
                    onChange={(e) => setRemoteForm((p) => ({ ...p, url: e.target.value }))}
                    className="w-full min-h-0 h-10 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-warning/30"
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-warning/10 bg-warning/[0.03] p-3">
                  <p className="text-sm font-medium text-foreground">Visa fjärrhjälpslänk</p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remoteForm.visible}
                      onChange={(e) => setRemoteForm((p) => ({ ...p, visible: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted-foreground/20 peer-focus:ring-2 peer-focus:ring-warning/30 rounded-full peer peer-checked:bg-warning transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 shadow-sm shadow-warning/10">
                    <ExternalLink className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{remoteHelpLabel}</p>
                    <p className="text-xs text-muted-foreground">Låt IT ansluta till din dator för att hjälpa dig</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isItOrAdmin && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground" onClick={startEditingRemoteHelp}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                  <Button asChild className="gap-2 bg-warning text-warning-foreground hover:bg-warning/90">
                    <a href={remoteHelpUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      <span className="hidden sm:inline">Öppna</span>
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* FAQ */}
      {managingFaq && isItOrAdmin ? (
        <FaqManager onClose={() => { setManagingFaq(false); setLoading(true); supabase.from("it_faq").select("id, question, answer, sort_order").eq("is_active", true).order("sort_order").then(({ data }) => { setFaq((data as FaqItem[]) ?? []); setLoading(false); }); }} />
      ) : !loading && faq.length > 0 ? (
        <Card className="glass-card border-t-2 border-t-accent/40">
          <CardHeader className="px-4 md:px-6 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shadow-sm shadow-accent/10">
                <HelpCircle className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1">
                <CardTitle className="font-heading text-base md:text-lg text-accent">Vanliga frågor</CardTitle>
                <CardDescription className="text-xs">Svar på de vanligaste IT-frågorna</CardDescription>
              </div>
              {isItOrAdmin && (
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground" onClick={() => setManagingFaq(true)}>
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <Accordion type="single" collapsible className="w-full">
              {faq.map((item) => (
                <AccordionItem key={item.id} value={item.id} className="border-border/50">
                  <AccordionTrigger className="text-sm font-medium text-foreground hover:text-primary py-4 text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ) : null}

      {/* PWA Installation Guide */}
      <PwaInstallGuide />
    </div>
  );
}
