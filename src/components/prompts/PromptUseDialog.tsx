import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractVariables, fillVariables } from "@/lib/promptVariables";
import { Copy } from "lucide-react";

interface Props {
  prompt: any | null;
  onOpenChange: (open: boolean) => void;
  onCopied: () => void;
}

export function PromptUseDialog({ prompt, onOpenChange, onCopied }: Props) {
  const open = !!prompt;
  const variables = useMemo(() => (prompt ? extractVariables(prompt.body) : []), [prompt]);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (prompt) setValues({});
  }, [prompt?.id]);

  if (!prompt) return null;

  const finalText = fillVariables(prompt.body, values);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(finalText);
      toast.success("Prompt kopierad till urklipp");
      await supabase.rpc("increment_prompt_copy" as any, { _prompt_id: prompt.id });
      onCopied();
      onOpenChange(false);
    } catch {
      toast.error("Kunde inte kopiera");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prompt.title}</DialogTitle>
          <DialogDescription>{prompt.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {variables.length > 0 && (
            <div className="space-y-3 p-3 rounded-md border bg-muted/40">
              <p className="text-xs font-medium text-muted-foreground">Fyll i variablerna (valfritt):</p>
              {variables.map((v) => (
                <div key={v}>
                  <Label htmlFor={`var-${v}`} className="text-xs">{v}</Label>
                  <Input
                    id={`var-${v}`}
                    value={values[v] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                    placeholder={`Värde för ${v}`}
                  />
                </div>
              ))}
            </div>
          )}
          <div>
            <Label className="text-xs">Förhandsvisning</Label>
            <Textarea readOnly value={finalText} rows={10} className="font-mono text-sm bg-background" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Stäng</Button>
          <Button onClick={handleCopy}><Copy className="h-4 w-4 mr-1" /> Kopiera</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
