import { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import propertiesData from "@/data/properties.json";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, MapPin, Search, X, Users, CalendarClock, BarChart3, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PropertyDetailsPanel } from "@/components/fastigheter/PropertyDetailsPanel";
import { TenantsView } from "@/components/fastigheter/TenantsView";
import { ContractsView } from "@/components/fastigheter/ContractsView";
import { ManagerDashboard } from "@/components/fastigheter/ManagerDashboard";
import { makeMatcher } from "@/lib/search";
import { tenantsFor } from "@/lib/rentroll";

interface Property {
  fastighet: string;
  ort: string;
  kommun?: string;
  forvaltare: string;
  teknisk: string;
  region: "Syd" | "Mitt" | "Nord";
  lat: number;
  lng: number;
}

const properties = propertiesData as Property[];


const REGION_COLORS: Record<string, string> = {
  Syd: "#E53935",
  Mitt: "#FB8C00",
  Nord: "#1E88E5",
};

const REGION_ORDER = ["Syd", "Mitt", "Nord"] as const;

type ColorBy = "region" | "forvaltare" | "teknisk";

function personColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

function FlyTo({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.6 });
  }, [center, zoom, map]);
  return null;
}

export default function Fastigheter() {
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [forvFilter, setForvFilter] = useState<string>("all");
  const [teknFilter, setTeknFilter] = useState<string>("all");
  const [colorBy, setColorBy] = useState<ColorBy>("region");
  const [selected, setSelected] = useState<Property | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  const forvaltareOptions = useMemo(
    () => Array.from(new Set(properties.map((p) => p.forvaltare))).sort((a, b) => a.localeCompare(b, "sv")),
    []
  );
  const tekniskOptions = useMemo(
    () => Array.from(new Set(properties.map((p) => p.teknisk))).sort((a, b) => a.localeCompare(b, "sv")),
    []
  );

  const filtered = useMemo(() => {
    const match = makeMatcher(search);
    return properties.filter((p) => {
      if (regionFilter !== "all" && p.region !== regionFilter) return false;
      if (forvFilter !== "all" && p.forvaltare !== forvFilter) return false;
      if (teknFilter !== "all" && p.teknisk !== teknFilter) return false;
      return match([p.fastighet, p.ort, p.kommun, p.forvaltare, p.teknisk, p.region, ...tenantsFor(p.fastighet)]);
    });
  }, [search, regionFilter, forvFilter, teknFilter]);


  const counts = useMemo(() => {
    const c: Record<string, number> = { Syd: 0, Mitt: 0, Nord: 0 };
    filtered.forEach((p) => (c[p.region] = (c[p.region] || 0) + 1));
    return c;
  }, [filtered]);

  const colorOf = (p: Property) => {
    if (colorBy === "region") return REGION_COLORS[p.region];
    if (colorBy === "forvaltare") return personColor(p.forvaltare);
    return personColor(p.teknisk);
  };

  const handleSelect = (p: Property) => {
    setSelected(p);
    setFlyTarget([p.lat, p.lng]);
  };

  const clearFilters = () => {
    setSearch("");
    setRegionFilter("all");
    setForvFilter("all");
    setTeknFilter("all");
  };

  const hasFilter = search || regionFilter !== "all" || forvFilter !== "all" || teknFilter !== "all";

  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-center gap-2 text-primary">
          <Building2 className="h-6 w-6" />
          <h1 className="text-2xl font-serif font-bold">Fastigheter</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Karta, hyresgäster, kontrakt och nyckeltal för samtliga {properties.length} fastigheter. Källa: Rent-roll 260501.
        </p>
      </header>

      <Tabs defaultValue="karta" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 md:w-auto md:inline-flex h-auto min-h-12 bg-muted/80 border shadow-sm p-1.5 gap-1">
          <TabsTrigger value="karta" className="gap-2 px-3 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"><MapIcon className="h-4 w-4" /><span>Karta</span></TabsTrigger>
          <TabsTrigger value="hyresgaster" className="gap-2 px-3 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"><Users className="h-4 w-4" /><span>Hyresgäster</span></TabsTrigger>
          <TabsTrigger value="kontrakt" className="gap-2 px-3 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"><CalendarClock className="h-4 w-4" /><span>Kontrakt</span></TabsTrigger>
          <TabsTrigger value="forvaltare" className="gap-2 px-3 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"><BarChart3 className="h-4 w-4" /><span>Förvaltare</span></TabsTrigger>
        </TabsList>

        <TabsContent value="karta" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            <Card className="overflow-hidden h-[520px] lg:h-[70vh] relative">
              <MapContainer center={[62.5, 15.5]} zoom={5} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FlyTo center={flyTarget} zoom={13} />
                {filtered.map((p) => (
                  <CircleMarker
                    key={`${p.fastighet}-${p.lat}-${p.lng}`}
                    center={[p.lat, p.lng]}
                    radius={selected?.fastighet === p.fastighet ? 9 : 6}
                    pathOptions={{ color: "#fff", weight: 1.5, fillColor: colorOf(p), fillOpacity: 0.9 }}
                    eventHandlers={{ click: () => setSelected(p) }}
                  >
                    <Popup maxWidth={320} minWidth={280}>
                      <PropertyDetailsPanel
                        fastighet={p.fastighet}
                        ort={p.kommun && p.kommun !== p.ort ? `${p.ort}, ${p.kommun} kommun` : p.ort}
                        region={p.region}
                        regionColor={REGION_COLORS[p.region]}
                      />
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>

              <div className="absolute bottom-3 left-3 z-[400] bg-background/95 backdrop-blur rounded-md shadow-md border px-3 py-2 text-xs space-y-1">
                <div className="font-semibold mb-1">Regioner</div>
                {REGION_ORDER.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: REGION_COLORS[r] }} />
                    <span>{r}</span>
                    <span className="text-muted-foreground ml-auto">({counts[r] || 0})</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-3 flex flex-col h-[70vh] min-h-[520px]">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök fastighet, ort, kommun, hyresgäst (t.ex. Ica*)..." className="pl-8 h-9" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select value={regionFilter} onValueChange={setRegionFilter}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Region" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla regioner</SelectItem>
                      {REGION_ORDER.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={colorBy} onValueChange={(v) => setColorBy(v as ColorBy)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="region">Färg: Region</SelectItem>
                      <SelectItem value="forvaltare">Färg: Förvaltare</SelectItem>
                      <SelectItem value="teknisk">Färg: Teknisk förv.</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={forvFilter} onValueChange={setForvFilter}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Förvaltare" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla förvaltare</SelectItem>
                      {forvaltareOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={teknFilter} onValueChange={setTeknFilter}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Teknisk" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla tekniska</SelectItem>
                      {tekniskOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">
                    Visar <strong className="text-foreground">{filtered.length}</strong> av {properties.length}
                  </span>
                  {hasFilter && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={clearFilters}>
                      <X className="h-3 w-3 mr-1" /> Rensa
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex-1 overflow-y-auto -mx-3 px-1 border-t">
                {filtered.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">Inga fastigheter matchar filtret.</div>
                ) : (
                  <ul className="divide-y">
                    {filtered.map((p) => (
                      <li key={`${p.fastighet}-${p.lat}`}>
                        <button
                          onClick={() => handleSelect(p)}
                          className={cn(
                            "w-full text-left px-3 py-2 hover:bg-accent/40 transition-colors border-l-4",
                            selected?.fastighet === p.fastighet && "bg-accent/60"
                          )}
                          style={{ borderLeftColor: REGION_COLORS[p.region] }}
                        >
                          <div className="text-sm font-medium truncate">{p.fastighet}</div>
                          <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {p.ort}{p.kommun && p.kommun !== p.ort ? ` (${p.kommun})` : ""} · {p.forvaltare}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="hyresgaster"><TenantsView /></TabsContent>
        <TabsContent value="kontrakt"><ContractsView /></TabsContent>
        <TabsContent value="forvaltare"><ManagerDashboard /></TabsContent>
      </Tabs>
    </div>
  );
}
