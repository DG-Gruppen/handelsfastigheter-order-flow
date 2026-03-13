import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, HelpCircle, GripVertical, ArrowLeft } from "lucide-react";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
}

const emptyForm = { question: "", answer: "" };

export default function FaqManager({ onClose }: { onClose?: () => void }) {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const { data } = await supabase
      .from("it_faq")
      .select("*")
      .order("sort_order");
    setItems((data as FaqItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: FaqItem) => {
    setEditingId(item.id);
    setForm({ question: item.question, answer: item.answer });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error("Fyll i både fråga och svar");
      return;
    }
    setSubmitting(true);

    if (editingId) {
      const { error } = await supabase
        .from("it_faq")
        .update({ question: form.question.trim(), answer: form.answer.trim() } as any)
        .eq("id", editingId);
      if (error) toast.error("Kunde inte uppdatera");
      else toast.success("FAQ uppdaterad");
    } else {
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : 0;
      const { error } = await supabase.from("it_faq").insert({
        question: form.question.trim(),
        answer: form.answer.trim(),
        sort_order: maxOrder + 1,
      } as any);
      if (error) toast.error("Kunde inte skapa");
      else toast.success("FAQ skapad");
    }

    setDialogOpen(false);
    setSubmitting(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("it_faq").delete().eq("id", id);
    toast.success("FAQ borttagen");
    fetchData();
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("it_faq").update({ is_active: !current } as any).eq("id", id);
    fetchData();
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const current = items[index];
    const above = items[index - 1];
    await Promise.all([
      supabase.from("it_faq").update({ sort_order: above.sort_order } as any).eq("id", current.id),
      supabase.from("it_faq").update({ sort_order: current.sort_order } as any).eq("id", above.id),
    ]);
    fetchData();
  };

  const handleMoveDown = async (index: number) => {
    if (index >= items.length - 1) return;
    const current = items[index];
    const below = items[index + 1];
    await Promise.all([
      supabase.from("it_faq").update({ sort_order: below.sort_order } as any).eq("id", current.id),
      supabase.from("it_faq").update({ sort_order: current.sort_order } as any).eq("id", below.id),
    ]);
    fetchData();
  };

  return (
    <>
      <Card className="glass-card border-t-2 border-t-accent/40">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shadow-sm shadow-accent/10">
                <HelpCircle className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="font-heading text-base md:text-lg text-accent">Vanliga frågor (FAQ)</CardTitle>
                <CardDescription className="text-xs">Hantera frågor som visas på IT-supportsidan</CardDescription>
              </div>
            </div>
            <Button className="gap-1.5 h-11 md:h-10" onClick={openNew}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Ny fråga</span>
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground" onClick={onClose}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Laddar...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Inga FAQ tillagda ännu</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`rounded-xl border border-border p-3 md:p-3.5 flex items-start gap-3 transition-opacity ${
                    !item.is_active ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex flex-col gap-0.5 shrink-0 mt-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors p-0.5"
                    >
                      <GripVertical className="h-3.5 w-3.5 rotate-90 scale-x-[-1]" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === items.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors p-0.5"
                    >
                      <GripVertical className="h-3.5 w-3.5 rotate-90" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{item.question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.answer}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => handleToggleActive(item.id, item.is_active)}
                      className="mr-1"
                    />
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="mx-4 max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Redigera fråga" : "Ny fråga"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fråga *</Label>
              <Input
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="T.ex. Hur återställer jag mitt lösenord?"
                className="h-12 md:h-10"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Svar *</Label>
              <Textarea
                value={form.answer}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                placeholder="Skriv ett tydligt svar..."
                rows={4}
                maxLength={1000}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto h-11">
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={submitting} className="w-full sm:w-auto h-11">
              {submitting ? "Sparar..." : editingId ? "Spara" : "Skapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
