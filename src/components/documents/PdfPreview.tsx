import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PDFDocumentProxy } from "pdfjs-dist";

export default function PdfPreview({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(700);
  const [error, setError] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    import("pdfjs-dist").then(async pdfjs => {
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const task = pdfjs.getDocument({ url, isEvalSupported: false });
      cleanup = () => { void task.destroy(); };
      const doc = await task.promise;
      if (!disposed) setDocument(doc);
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; cleanup(); };
  }, [url]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let cancelRender = () => {};
    (async () => {
      const pdfPage = await document.getPage(page);
      if (cancelled || !canvas.current) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: Math.max(0.1, (width - 16) / base.width) * zoom });
      const target = canvas.current;
      const context = target.getContext("2d");
      if (!context) return;
      const ratio = window.devicePixelRatio || 1;
      target.width = Math.floor(viewport.width * ratio);
      target.height = Math.floor(viewport.height * ratio);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      const render = pdfPage.render({ canvasContext: context, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      cancelRender = () => render.cancel();
      await render.promise;
      const content = await pdfPage.getTextContent();
      if (!cancelled) setText(content.items.map(item => "str" in item ? item.str : "").join(" "));
    })().catch(e => { if (!cancelled && e?.name !== "RenderingCancelledException") setError(true); });
    return () => { cancelled = true; cancelRender(); };
  }, [document, page, zoom, width]);
  if (error) return <p role="alert" className="p-4 text-destructive">PDF-filen kunde inte visas. Prova att öppna den separat eller ladda ner den.</p>;
  return <div ref={container} className="min-w-0">
    <div className="flex items-center justify-center gap-2 flex-wrap border-b border-border pb-2 mb-3">
      <Button variant="ghost" size="icon" title="Föregående sida" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft /></Button>
      <span className="text-sm tabular-nums" aria-live="polite">Sida {page} av {document?.numPages ?? "…"}</span>
      <Button variant="ghost" size="icon" title="Nästa sida" disabled={!document || page >= document.numPages} onClick={() => setPage(p => p + 1)}><ChevronRight /></Button>
      <Button variant="ghost" size="icon" title="Zooma ut" disabled={zoom <= 0.5} onClick={() => setZoom(z => z - 0.25)}><ZoomOut /></Button>
      <Button variant="ghost" size="icon" title="Zooma in" disabled={zoom >= 2} onClick={() => setZoom(z => z + 0.25)}><ZoomIn /></Button>
    </div>
    {!document && <p className="p-4 text-muted-foreground" role="status">Laddar PDF…</p>}
    <div className="overflow-auto max-h-[60vh] overscroll-contain"><canvas ref={canvas} className="mx-auto" aria-label={`Sida ${page}`} /><p className="sr-only">{text}</p></div>
  </div>;
}