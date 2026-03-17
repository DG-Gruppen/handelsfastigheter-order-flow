import { ExternalLink } from "lucide-react";

const tools = [
  { name: "Vitec", description: "Fastighetssystem", emoji: "🏠", url: "https://fsab-handelsfastigheter.vitec.net/" },
  { name: "Vyer", description: "Fastighetsvisning", emoji: "👁️", url: "https://app.vyer.com/sites" },
  { name: "Zendesk", description: "Ärendehantering & support", emoji: "🎧", url: "https://lsthsvenskahandelsfastigheter.zendesk.com/hc/sv" },
  { name: "Rillion", description: "Fakturahantering", emoji: "🧾", url: "https://p29254x03.rillionprime.com/" },
  { name: "ViaEstate", description: "Fastighetsdata & analys", emoji: "🏢", url: "https://viaestate.viametrics.com/login" },
  { name: "Momentum", description: "Underhållssystem", emoji: "🔧", url: "https://rc.momentum.se/" },
  { name: "Metry", description: "Energiuppföljning", emoji: "⚡", url: "https://app.metry.io/" },
  { name: "SHF Webb", description: "handelsfastigheter.se", emoji: "🌐", url: "https://handelsfastigheter.se/" },
  { name: "Microsoft 365", description: "Teams, Outlook, SharePoint", emoji: "💼", url: "https://office.com" },
  { name: "Power BI", description: "Rapportering & Analys", emoji: "📈", url: "https://app.powerbi.com" },
  { name: "DocuSign", description: "E-signering av avtal", emoji: "✍️", url: "https://docusign.com" },
  { name: "IT-portalen", description: "it.handelsfastigheter.se", emoji: "💻", url: "https://it.handelsfastigheter.se" },
  { name: "Cision News", description: "Pressmeddelanden", emoji: "📋", url: "https://news.cision.com/se/svenska-handelsfastigheter" },
  { name: "Google Drive", description: "Delade dokument", emoji: "🗂️", url: "https://drive.google.com" },
];

export default function Tools() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Verktyg</h1>
        <p className="text-sm text-muted-foreground mt-1">Snabbåtkomst till alla system och tjänster</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <a
            key={tool.name}
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card rounded-lg border border-border p-5 hover:border-primary/30 transition-colors group flex items-start gap-4"
          >
            <span className="text-3xl">{tool.emoji}</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{tool.name}</h3>
              <p className="text-xs text-muted-foreground">{tool.description}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
          </a>
        ))}
      </div>
    </div>
  );
}
