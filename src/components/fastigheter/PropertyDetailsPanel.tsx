import { Badge } from "@/components/ui/badge";
import { getAgg, unitsFor, fmtKr, fmtNum, fmtDate, addressFor, googleMapsUrl } from "@/lib/rentroll";
import { Building2, MapPin, User, Wrench, Users, Home, Navigation } from "lucide-react";

interface Props {
  fastighet: string;
  ort: string;
  region: string;
  regionColor: string;
  compact?: boolean;
  lat?: number;
  lng?: number;
}

export function PropertyDetailsPanel({ fastighet, ort, region, regionColor, compact, lat, lng }: Props) {
  const agg = getAgg(fastighet);
  const units = unitsFor(fastighet);
  const adress = addressFor(fastighet);
  const mapsHref = googleMapsUrl(fastighet, lat, lng);

  const MapsButton = (
    <a
      href={mapsHref}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-1.5 w-full rounded-md bg-primary text-primary-foreground text-xs font-semibold py-2 min-h-11 no-underline"
    >
      <Navigation className="h-3.5 w-3.5" /> Öppna i Google Maps
    </a>
  );

  if (compact) {
    return (
      <div className="space-y-2 text-sm">
        <div>
          <div className="font-semibold text-base leading-tight">{fastighet}</div>
          <div className="text-xs text-muted-foreground">{adress || ort}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Badge style={{ backgroundColor: regionColor, color: "#fff" }} className="text-[10px]">{region}</Badge>
          {agg && <span className="text-muted-foreground">{fmtNum(agg.objekt)} objekt · {fmtNum(agg.area, "m²")}</span>}
        </div>
        {agg && agg.vakanta > 0 && (
          <div className="text-xs text-[hsl(var(--destructive))] font-medium">{fmtNum(agg.vakanta)} vakanta</div>
        )}
        {agg && agg.butiker.length > 0 && (
          <div className="text-xs text-muted-foreground truncate">{agg.butiker.slice(0, 3).join(", ")}</div>
        )}
        {MapsButton}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="font-semibold text-base">{fastighet}</span>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3" /> {adress || ort}
        </div>
        <Badge style={{ backgroundColor: regionColor, color: "#fff" }} className="mt-2">
          Region {region}
        </Badge>
        <div className="mt-2">{MapsButton}</div>
      </div>


      {agg && (
        <>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <Stat label="Objekt" value={fmtNum(agg.objekt)} />
            <Stat label="Vakanta" value={fmtNum(agg.vakanta)} accent={agg.vakanta > 0} />
            <Stat label="Total area" value={fmtNum(agg.area, "m²")} />
            <Stat label="Hyresgäster" value={fmtNum(agg.antal_hg)} />
            <Stat label="Hyra (period)" value={fmtKr(agg.hyra)} />
            <Stat label="Hyresvärde" value={fmtKr(agg.hvp)} />
          </div>

          <div className="pt-2 border-t space-y-1 text-xs">
            {agg.agare && <Row icon={<Home className="h-3 w-3" />} label="Ägare" value={agg.agare} />}
            {agg.omr && <Row icon={<MapPin className="h-3 w-3" />} label="Område" value={agg.omr} />}
            {agg.forv && <Row icon={<User className="h-3 w-3" />} label="Förvaltare" value={agg.forv} />}
            {agg.tf && <Row icon={<Wrench className="h-3 w-3" />} label="Teknisk" value={agg.tf} />}
          </div>

          {agg.butiker.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs font-semibold mb-1 flex items-center gap-1">
                <Users className="h-3 w-3" /> Kedjor / butiker
              </div>
              <div className="flex flex-wrap gap-1">
                {agg.butiker.map((b) => (
                  <Badge key={b} variant="secondary" className="text-[10px] font-normal">{b}</Badge>
                ))}
              </div>
            </div>
          )}

          {units.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs font-semibold mb-1">Hyresgäster ({units.length})</div>
              <div className="max-h-56 overflow-y-auto -mx-1 pr-1 divide-y">
                {units.map((u, i) => (
                  <div key={i} className="py-1.5 px-1 text-xs">
                    <div className="font-medium truncate">
                      {u.hg || <span className="text-muted-foreground italic">Vakant</span>}
                    </div>
                    <div className="text-muted-foreground truncate">
                      {u.typ || "–"} · {fmtNum(u.area, "m²")} · {fmtKr(u.hyra)}
                    </div>
                    {u.to && (
                      <div className="text-[10px] text-muted-foreground">
                        Kontrakt t.o.m. {fmtDate(u.to)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-muted/40 rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"text-sm font-semibold " + (accent ? "text-[hsl(var(--destructive))]" : "")}>{value}</div>
    </div>
  );
}
function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <span className="text-muted-foreground w-20 shrink-0">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
