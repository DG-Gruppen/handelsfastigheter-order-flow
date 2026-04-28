import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  prompt: any | null;
  onOpenChange: (open: boolean) => void;
}

export function PromptSuggestDialog({ prompt, onOpenChange }: Props) {
  const { user } = useAuth();
  const open = !!prompt;
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (prompt) { setBody(prompt.body); setMessage(""); } }, [prompt?.id]);

  if (!prompt) return null;

  const handleSubmit = async () => {
    if (!user) return;
    if (!message.trim() && body === prompt.body) {
      toast.error("Beskriv ändringen eller redigera prompt-texten");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("prompt_suggestions" as any).insert({
      prompt_id: prompt.id,
      suggested_by: user.id,
      suggested_body: body !== prompt.body ? body : null,
      message: message.trim(),
    });
    setSaving(false);
    if (error) { toast.error("Kunde inte skicka förslag"); return; }
    toast.success("Förslag skickat till skaparen");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Föreslå ändring</DialogTitle>
          <DialogDescription>Skaparen och admin får ditt förslag och kan godkänna det.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Föreslagen prompt-text</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="font-mono text-sm" />
          </div>
          <div>
            <Label>Kommentar / motivering</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Varför bör prompten ändras?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Skickar..." : "Skicka förslag"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
