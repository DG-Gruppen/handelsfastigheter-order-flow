import WorkwearOrder from "@/components/workwear/WorkwearOrder";

export default function Workwear() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Arbetskläder</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Beställ arbetskläder från 157 Work</p>
      </div>
      <WorkwearOrder />
    </div>
  );
}
