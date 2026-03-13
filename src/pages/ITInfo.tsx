import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavSettings } from "@/hooks/useNavSettings";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Clock, ExternalLink, HelpCircle, Headphones, Settings } from "lucide-react";
import FaqManager from "@/components/FaqManager";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

export default function ITInfo() {
  const { settings } = useNavSettings();
  const { roles } = useAuth();
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [managingFaq, setManagingFaq] = useState(false);
  const isItOrAdmin = roles.includes("admin") || roles.includes("it");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("it_faq")
        .select("id, question, answer, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      setFaq((data as FaqItem[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const remoteHelpUrl = settings["it_remote_help_url"] || "https://my.splashtop.eu/sos/packages/download/37PXZW4LPWXTEU";
  const remoteHelpLabel = settings["it_remote_help_label"] || "Fjärrhjälp (Splashtop)";
  const showRemoteHelp = settings["it_remote_help_visible"] !== "false";

  const contactEmail = settings["it_contact_email"] || "helpdesk@dggruppen.se";
  const contactPhone = settings["it_contact_phone"] || "08 - 72 17 222 -> tryck 1";
  const contactHours = settings["it_contact_hours"] || "Mån – Fre | 08:00 – 17:00";

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
            <div>
              <CardTitle className="font-heading text-base md:text-lg text-primary">Kontakta IT</CardTitle>
              <CardDescription className="text-xs">Behöver du hjälp? Kontakta oss via något av sätten nedan</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
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
        </CardContent>
      </Card>

      {/* Remote help */}
      {showRemoteHelp && (
        <Card className="glass-card border-t-2 border-t-warning/40">
          <CardContent className="px-4 md:px-6 py-5">
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
              <Button asChild className="gap-2 shrink-0 bg-warning text-warning-foreground hover:bg-warning/90">
                <a href={remoteHelpUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">Öppna</span>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQ */}
      {!loading && faq.length > 0 && (
        <Card className="glass-card border-t-2 border-t-accent/40">
          <CardHeader className="px-4 md:px-6 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shadow-sm shadow-accent/10">
                <HelpCircle className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="font-heading text-base md:text-lg text-accent">Vanliga frågor</CardTitle>
                <CardDescription className="text-xs">Svar på de vanligaste IT-frågorna</CardDescription>
              </div>
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
      )}
    </div>
  );
}
