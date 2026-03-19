export interface WorkwearVariant {
  color: string;
  colorLabel: string;
  url: string;
}

export interface WorkwearProduct {
  id: string;
  name: string;
  variants: WorkwearVariant[];
  sizes: string[];
  gender: "herr" | "dam";
}

export type Season = "sommar" | "host" | "vinter" | "var";

export const SEASON_LABELS: Record<Season, string> = {
  sommar: "Sommar",
  host: "Höst",
  vinter: "Vinter",
  var: "Vår",
};

export const ALL_SEASONS: Season[] = ["var", "sommar", "host", "vinter"];

/** Products grouped by season. Only summer has items for now. */
export const PRODUCTS_BY_SEASON: Record<Season, WorkwearProduct[]> = {
  sommar: [
    // ── HERR ──
    { id: "h-tshirt-william", gender: "herr", name: "T-shirt William", variants: [
      { color: "white", colorLabel: "Vit", url: "https://www.157work.com/p/heavy-t-shirt-william/white/" },
    ], sizes: ["S", "M", "L", "XL", "XXL"] },
    { id: "h-pike-alan", gender: "herr", name: "Pikétröja Alan", variants: [
      { color: "white", colorLabel: "Vit", url: "https://www.157work.com/p/pik-alan/white/" },
      { color: "navy", colorLabel: "Navy", url: "https://www.157work.com/p/pik-alan/navy-5/" },
    ], sizes: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"] },
    { id: "h-skjorta-lucas", gender: "herr", name: "Linneskjorta Lucas", variants: [
      { color: "white", colorLabel: "Vit", url: "https://www.157work.com/p/linneskjorta-lucas/white/" },
      { color: "navy", colorLabel: "Navy", url: "https://www.157work.com/p/linneskjorta-lucas/navy-5/" },
    ], sizes: ["S", "M", "L", "XL", "XXL"] },
    { id: "h-jeansskjorta-dakota", gender: "herr", name: "Jeansskjorta Dakota", variants: [
      { color: "denim-blue", colorLabel: "Denim Blue", url: "https://www.157work.com/p/jeansskjorta-dakota/denim-blue/" },
    ], sizes: ["S", "M", "L", "XL", "XXL"] },
    { id: "h-worker-mechanic", gender: "herr", name: "Kortärmad Skjorta Mechanic", variants: [
      { color: "navy", colorLabel: "Navy", url: "https://www.157work.com/p/skjorta-mechanic-shirt/navy/" },
    ], sizes: ["S", "M", "L", "XL", "XXL"] },
    { id: "h-vast-liared", gender: "herr", name: "Väst Liared", variants: [
      { color: "black", colorLabel: "Svart", url: "https://www.157work.com/p/liared-vest/black/" },
      { color: "navy", colorLabel: "Navy", url: "https://www.157work.com/p/liared-vest/navy/" },
    ], sizes: ["S", "M", "L", "XL", "XXL"] },
    { id: "h-pilejacka-vallen", gender: "herr", name: "Piléjacka Vallen 2.0", variants: [
      { color: "navy", colorLabel: "Navy", url: "https://www.157work.com/p/pilejacka-vallen-2-0/navy/" },
    ], sizes: ["S", "M", "L", "XL", "XXL"] },
    { id: "h-hybridjacka-ms", gender: "herr", name: "Hybridjacka MS", variants: [
      { color: "black", colorLabel: "Svart", url: "https://www.157work.com/p/hybridjacka-ms-hybrid-jacket/black/" },
      { color: "navy", colorLabel: "Navy", url: "https://www.157work.com/p/hybridjacka-ms-hybrid-jacket/navy/" },
    ], sizes: ["XS", "S", "M", "L", "XL", "XXL"] },

    // ── DAM ──
    { id: "d-tshirt-bea", gender: "dam", name: "T-shirt Bea (rak)", variants: [
      { color: "white", colorLabel: "Vit", url: "https://www.157work.com/p/basic-t-shirt-bea/white/" },
    ], sizes: ["XS", "S", "M", "L", "XL", "XXL", "3XL"] },
    { id: "d-tshirt-filippa", gender: "dam", name: "T-shirt Filippa (figurnära)", variants: [
      { color: "white", colorLabel: "Vit", url: "https://www.157work.com/p/t-shirt-filippa/white/" },
    ], sizes: ["XS", "S", "M", "L", "XL"] },
    { id: "d-skjorta-cristin", gender: "dam", name: "Skjorta Cristin (figursydd)", variants: [
      { color: "white", colorLabel: "Vit", url: "https://www.157work.com/p/cristin-shirt/white/" },
    ], sizes: ["XS", "S", "M", "L", "XL"] },
    { id: "d-skjorta-stephanie", gender: "dam", name: "Skjorta Stephanie (rak)", variants: [
      { color: "white", colorLabel: "Vit", url: "https://www.157work.com/p/skjorta-stephanie/white/" },
    ], sizes: ["XS", "S", "M", "L", "XL"] },
    { id: "d-jeansskjorta-dallas", gender: "dam", name: "Jeansskjorta Dallas", variants: [
      { color: "blue-used", colorLabel: "Blue Used", url: "https://www.157work.com/p/jeansskjorta-dallas/blue-used/" },
    ], sizes: ["XS", "S", "M", "L", "XL"] },
    { id: "d-vast-lindas", gender: "dam", name: "Väst Lindås", variants: [
      { color: "black", colorLabel: "Svart", url: "https://www.157work.com/p/lindas-vest/black/" },
      { color: "navy", colorLabel: "Navy", url: "https://www.157work.com/p/lindas-vest/navy/" },
    ], sizes: ["XS", "S", "M", "L", "XL"] },
    { id: "d-pilejacka-valla", gender: "dam", name: "Piléjacka Valla", variants: [
      { color: "ivory", colorLabel: "Ivory", url: "https://www.157work.com/p/pilejacka-valla/ivory/" },
      { color: "black", colorLabel: "Svart", url: "https://www.157work.com/p/pilejacka-valla/black/" },
      { color: "dk-beige", colorLabel: "DK Beige (brodyr svart)", url: "https://www.157work.com/p/pilejacka-valla/dk-beige/" },
      { color: "burgundy", colorLabel: "Burgundy (brodyr vit)", url: "https://www.157work.com/p/pilejacka-valla/burgundy/" },
    ], sizes: ["XS", "S", "M", "L", "XL"] },
    { id: "d-hybridjacka-ws", gender: "dam", name: "Hybridjacka WS", variants: [
      { color: "black", colorLabel: "Svart", url: "https://www.157work.com/p/hybridjacka-ws-hybrid-jacket/black/" },
      { color: "navy", colorLabel: "Navy", url: "https://www.157work.com/p/hybridjacka-ws-hybrid-jacket/navy/" },
    ], sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
  ],
  host: [],
  vinter: [],
  var: [],
};

export const COLOR_DOT: Record<string, string> = {
  white: "bg-white border border-border",
  "off-white": "bg-stone-100 border border-border",
  "blue-used": "bg-blue-400",
  "black-used": "bg-zinc-700",
  "denim-blue": "bg-blue-600",
  "mid-wash": "bg-blue-500",
  rinse: "bg-indigo-950",
  black: "bg-zinc-900",
  navy: "bg-indigo-900",
  khaki: "bg-amber-700",
  ivory: "bg-amber-50 border border-border",
};
