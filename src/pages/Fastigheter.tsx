import { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import propertiesData from "@/data/properties.json";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, User, Wrench, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Property {
  fastighet: string;
  ort: string;
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

// Stable color per person derived from name hash
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
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (regionFilter !== "all" && p.region !== regionFilter) return false;
      if (forvFilter !== "all" && p.forvaltare !== forvFilter) return false;
      if (teknFilter !== "all" && p.teknisk !== teknFilter) return false;
      if (q) {
        return (
          p.fastighet.toLowerCase().includes(q) ||
          p.ort.toLowerCase().includes(q) ||
          p.forvaltare.toLowerCase().includes(q) ||
          p.teknisk.toLowerCase().includes(q)
        );
      }
      return true;
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
          Karta och register över samtliga {properties.length} fastigheter i beståndet.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Map */}
        <Card className="overflow-hidden h-[520px] lg:h-[70vh] relative">
          <MapContainer
            center={[62.5, 15.5]}
            zoom={5}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyTo center={flyTarget} zoom={13} />
            {filtered.map((p) => (
              <CircleMarker
                key={`${p.fastighet}-${p.lat}-${p.lng}`}
                center={[p.lat, p.lng]}
                radius={selected?.fastighet === p.fastighet ? 9 : 6}
                pathOptions={{
                  color: "#fff",
                  weight: 1.5,
                  fillColor: colorOf(p),
                  fillOpacity: 0.9,
                }}
                eventHandlers={{ click: () => setSelected(p) }}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    <div className="font-semibold text-base">{p.fastighet}</div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {p.ort}
                    </div>
                    <div className="flex items-center gap-1"><User className="h-3 w-3" /> {p.forvaltare}</div>
                    <div className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {p.teknisk}</div>
                    <Badge
                      style={{ backgroundColor: REGION_COLORS[p.region], color: "#fff" }}
                      className="mt-1"
                    >
                      Region {p.region}
                    </Badge>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[400] bg-background/95 backdrop-blur rounded-md shadow-md border px-3 py-2 text-xs space-y-1">
            <div className="font-semibold mb-1">Regioner</div>
            {REGION_ORDER.map((r) => (
              <div key={r} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: REGION_COLORS[r] }}
                />
                <span>{r}</span>
                <span className="text-muted-foreground ml-auto">({counts[r] || 0})</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Sidebar */}
        <Card className="p-3 flex flex-col h-[70vh] min-h-[520px]">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sök fastighet, ort, förvaltare..."
                className="pl-8 h-9"
              />
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
              <div className="text-center text-sm text-muted-foreground py-8">
                Inga fastigheter matchar filtret.
              </div>
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
                        <MapPin className="h-3 w-3" /> {p.ort} · {p.forvaltare}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
