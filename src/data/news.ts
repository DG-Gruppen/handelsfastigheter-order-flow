export interface NewsPost {
  id: string;
  title: string;
  body: string;
  category: string;
  emoji: string;
  isPinned: boolean;
  publishedAt: string;
}

export const newsPosts: NewsPost[] = [
  { id: "1", title: "Helårsrapport 2025: Hyresintäkter 1 809,9 Mkr (+21%)", body: "Portföljvärde 22 735,9 Mkr, direktavkastning 6,60%, soliditet 42,2%. Ett rekordår för SHF med stark tillväxt i samtliga regioner.", category: "Rapport", emoji: "📊", isPinned: true, publishedAt: "2026-02-15" },
  { id: "2", title: "Förvärv Bernstorp Malmö: 4 fastigheter, 928,5 Mkr", body: "48 000 kvm handelsyta med starka hyresgäster som Bauhaus, Jula, Elgiganten, Citygross och Stadium.", category: "Förvärv", emoji: "🏗️", isPinned: false, publishedAt: "2026-01-20" },
  { id: "3", title: "Grön obligation 600 Mkr emitterad", body: "Stibor + 88 bps, förfall februari 2029. Totalt 2 150 Mkr utestående gröna obligationer.", category: "Finans", emoji: "🌱", isPinned: false, publishedAt: "2026-01-15" },
  { id: "4", title: "Sustainalytics ESG #1 Norden, Topp 3 Europa", body: "SHF erhåller betyg 8,4 och rankas som nummer ett i Norden och topp tre i Europa.", category: "Hållbarhet", emoji: "🏆", isPinned: false, publishedAt: "2025-12-10" },
  { id: "5", title: "Claes Setthagen ny Regionchef Mitt", body: "Claes efterträder Maria Huss och tar ansvar för hela Region Mitt med fokus på tillväxt och förvaltning.", category: "Personal", emoji: "👤", isPinned: false, publishedAt: "2025-11-28" },
];
