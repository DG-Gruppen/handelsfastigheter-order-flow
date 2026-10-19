import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocFile } from "@/hooks/useDocuments";
import { getPreviewKind } from "@/lib/documentPreview";
import { TextPreview } from "./documentHelpers";
import PdfPreview from "./PdfPreview";

type Sheet = { name: string; rows: string[][]; truncated: boolean };

export default function DocumentPreview({ file, url }: { file: DocFile; url: string }) {
  const kind = getPreviewKind(file.mime_type, file.name);
  const [html, setHtml] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState("0");
  const [error, setError] = useState(false);
  const [officeConsent, setOfficeConsent] = useState(false);
  useEffect(() => {
    if (!["word", "spreadsheet", "html"].includes(kind)) return;
    const controller = new AbortController();
    (async () => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("File unavailable");
      if (kind === "html") {
        const source = await response.text();
        if (!controller.signal.aborted) setHtml(DOMPurify.sanitize(source, { FORBID_TAGS: ["style", "iframe", "form", "object", "embed"], FORBID_ATTR: ["style", "src", "srcset"] }));
      } else if (kind === "word") {
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer: await response.arrayBuffer() });
        if (!controller.signal.aborted) setHtml(DOMPurify.sanitize(result.value, { FORBID_TAGS: ["style", "iframe", "form", "object", "embed"], FORBID_ATTR: ["style", "srcset"], ADD_DATA_URI_TAGS: ["img"] }).replace(/src="https?:[^\"]*"/g, ""));
      } else {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await response.arrayBuffer(), { type: "array", cellDates: true, sheetRows: 1001, bookVBA: false });
        const result = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name];
          const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
          const full = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"] ?? "A1");
          const bounded = { s: range.s, e: { r: Math.min(range.e.r, range.s.r + 999), c: Math.min(range.e.c, range.s.c + 49) } };
          return { name, rows: XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "", range: bounded }), truncated: full.e.r > bounded.e.r || full.e.c > bounded.e.c };
        });
        if (!controller.signal.aborted) setSheets(result);
      }
    })().catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [url, kind]);
  if (error) return <p role="alert" className="p-4 text-destructive">Filen kunde inte förhandsvisas. Du kan fortfarande ladda ner den.</p>;
  if (kind === "pdf") return <PdfPreview url={url} />;
  if (kind === "image") return <img src={url} alt={file.name} className="max-w-full max-h-[65vh] object-contain mx-auto" onError={() => setError(true)} />;
  if (kind === "video") return <video src={url} controls playsInline preload="metadata" className="w-full max-h-[65vh]" onError={() => setError(true)} />;
  if (kind === "audio") return <audio src={url} controls preload="metadata" className="w-full" onError={() => setError(true)} />;
  if (kind === "text") return <TextPreview url={url} />;
  if (kind === "html" || kind === "word") return html === null ? <p role="status" className="p-4 text-muted-foreground">Läser dokument…</p> : <article className="prose prose-sm dark:prose-invert max-w-none p-4 break-words [&_table]:block [&_table]:overflow-auto [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: html }} />;
  if (kind === "spreadsheet") {
    const sheet = sheets[Number(sheetIndex)];
    if (!sheet) return <p role="status" className="p-4 text-muted-foreground">Läser kalkylblad…</p>;
    return <div className="space-y-3 min-w-0">
      <Select value={sheetIndex} onValueChange={setSheetIndex}><SelectTrigger aria-label="Kalkylblad" className="w-full sm:w-72"><SelectValue /></SelectTrigger><SelectContent>{sheets.map((s, i) => <SelectItem key={i} value={String(i)}>{s.name}</SelectItem>)}</SelectContent></Select>
      {sheet.truncated && <p className="text-sm text-muted-foreground">Förhandsvisningen visar upp till 1 000 rader och 50 kolumner. Hela innehållet finns i originalfilen.</p>}
      <div className="overflow-auto max-h-[60vh] overscroll-contain border border-border rounded"><table className="text-sm border-collapse w-full"><tbody>{sheet.rows.map((row, r) => <tr key={r} className="even:bg-muted/40"><th className="sticky left-0 bg-secondary text-muted-foreground p-2 border border-border font-normal">{r + 1}</th>{row.map((cell, c) => <td key={c} className="border border-border p-2 whitespace-pre-wrap min-w-24 max-w-80">{cell}</td>)}</tr>)}</tbody></table></div>
    </div>;
  }
  if (kind === "office") return officeConsent ? <div className="space-y-2"><p className="text-xs text-muted-foreground">Om visaren inte laddar kan du ladda ner originalfilen.</p><iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} title={file.name} referrerPolicy="no-referrer" className="w-full h-[65vh] border border-border rounded" /></div> : <div className="p-4 space-y-4"><p className="text-sm text-muted-foreground">PowerPoint och äldre Word-filer visas med Microsofts dokumentvisare. När du fortsätter får Microsoft tillfällig åtkomst till denna fil för förhandsvisning.</p><Button onClick={() => setOfficeConsent(true)}>Visa med Microsoft</Button></div>;
  return <p className="p-4 text-muted-foreground">Den här filtypen saknar förhandsvisning.</p>;
}