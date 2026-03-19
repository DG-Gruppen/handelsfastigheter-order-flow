import { ShoppingBag } from "lucide-react";
import WorkwearOrder from "@/components/workwear/WorkwearOrder";

export default function Workwear() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] p-6 md:p-8 text-primary-foreground">
        <div className="absolute -right-6 -top-6 opacity-10">
          <ShoppingBag className="w-32 h-32" />
        </div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold">Profilkläder</h1>
        <p className="text-sm mt-1 opacity-80">Beställ profilkläder från 157 Work</p>
      </div>
      <WorkwearOrder />
    </div>
  );
}
