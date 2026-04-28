import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PROMPT_CATEGORIES, extractVariables } from "@/lib/promptVariables";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: any | null;
  onSaved: () => void;
}

export function PromptEditorDialog({ open, onOpenChange, prompt, onSaved }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("Övrigt");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(prompt?.title ?? "");
      setDescription(prompt?.description ?? "");
      setBody(prompt?.body ?? "");
      setCategory(prompt?.category ?? "Övrigt");
    }
  }, [open, prompt]);

  const variables = extractVariables(body);

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim() || !body.trim()) {
      toast.error("Titel och prompt-text krävs");
      return;
    }
    setSaving(true);
    const payload: any = {
      title: title.trim(),
      description: description.trim(),
      body,
      category,
      variables,
    };
    let error;
    if (prompt?.id) {
      ({ error } = await supabase.from("prompts" as any).update(payload).eq("id", prompt.id));
    } else {
      payload.author_id = user.id;
      ({ error } = await supabase.from("prompts" as any).insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Kunde inte spara: " + error.message); return; }
    toast.success(prompt?.id ? "Prompt uppdaterad" : "Prompt skapad");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prompt?.id ? "Redigera prompt" : "Lägg till prompt"}</DialogTitle>
          <DialogDescription>
            Använd <code className="px-1 bg-muted rounded">{`{{variabel}}`}</code> i texten för fält som fylls i vid kopiering.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="p-title">Titel</Label>
            <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Skriv prospekttext för vakant lokal" />
          </div>
          <div>
            <Label htmlFor="p-cat">Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="p-cat"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROMPT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="p-desc">Kort beskrivning</Label>
            <Input id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Genererar ett säljande prospekt utifrån lokaldata." />
          </div>
          <div>
            <Label htmlFor="p-body">Prompt-text</Label>
            <Textarea
              id="p-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder={`Skriv ett säljande prospekt för lokalen {{adress}} i {{stad}}. Ytan är {{kvm}} kvm...`}
              className="font-mono text-sm"
            />
            {variables.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Variabler som upptäcks: {variables.map((v) => <code key={v} className="px-1 mx-0.5 bg-muted rounded">{`{{${v}}}`}</code>)}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Sparar..." : "Spara"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
