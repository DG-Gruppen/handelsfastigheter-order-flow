import { useState, useRef } from "react";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "📊";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "📽️";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  return "📎";
}

export function canPreview(mime: string) {
  return mime.startsWith("image/") || mime === "application/pdf" || mime.startsWith("text/");
}

export const ALL_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Chef" },
  { value: "staff", label: "Stab" },
  { value: "employee", label: "Anställd" },
];

export function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState("Laddar…");
  const fetchedRef = useRef(false);
  if (!fetchedRef.current) {
    fetchedRef.current = true;
    fetch(url).then(r => r.text()).then(setText).catch(() => setText("Kunde inte läsa filen."));
  }
  return <pre className="whitespace-pre-wrap text-sm font-mono bg-secondary/50 rounded p-4 max-h-[60vh] overflow-auto">{text}</pre>;
}
