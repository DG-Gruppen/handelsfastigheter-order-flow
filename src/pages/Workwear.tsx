import WorkwearOrder from "@/components/workwear/WorkwearOrder";

export default function Workwear() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Profilkläder</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Beställ profilkläder från 157 Work</p>
      </div>
      <WorkwearOrder />
    </div>
  );
}
