import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Truck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export function RejectDialog({ open, onOpenChange, reason, onReasonChange, onReject }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onReject: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-lg glass-surface">
        <DialogHeader>
          <DialogTitle>Avslå beställning</DialogTitle>
          <DialogDescription>Ange en anledning till avslaget (valfritt)</DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Anledning..."
          maxLength={500}
          className="resize-none"
        />
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto h-11">Avbryt</Button>
          <Button variant="destructive" onClick={onReject} className="w-full sm:w-auto h-11">Avslå</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeliverDialog({ open, onOpenChange, comment, onCommentChange, onDeliver, marking }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comment: string;
  onCommentChange: (comment: string) => void;
  onDeliver: () => void;
  marking: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-lg glass-surface">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Markera som levererad
          </DialogTitle>
          <DialogDescription>Lägg till en kommentar till beställaren (valfritt)</DialogDescription>
        </DialogHeader>
        <Textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="T.ex. 'Utrustningen finns att hämta i reception' eller 'Licens aktiverad, se mail för inloggning'..."
          maxLength={500}
          className="resize-none"
          rows={3}
        />
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto h-11">Avbryt</Button>
          <Button onClick={onDeliver} disabled={marking} className="w-full sm:w-auto h-11 gradient-primary hover:opacity-90">
            {marking ? "Uppdaterar..." : "Bekräfta leverans"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
