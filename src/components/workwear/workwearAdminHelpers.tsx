import React from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

/* ── Sort types ── */
export interface SortConfig {
  key: string;
  dir: "asc" | "desc";
}

export function toggleSort(current: SortConfig | null, key: string): SortConfig | null {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}

export function applySortString(rows: any[], sort: SortConfig | null): any[] {
  if (!sort) return rows;
  const { key, dir } = sort;
  return [...rows].sort((a, b) => {
    const aVal = a[key] ?? "";
    const bVal = b[key] ?? "";
    if (typeof aVal === "number" && typeof bVal === "number") {
      return dir === "asc" ? aVal - bVal : bVal - aVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal), "sv");
    return dir === "asc" ? cmp : -cmp;
  });
}

/* ── Sortable header component ── */
interface SortableHeaderProps {
  label: string;
  sortKey: string;
  current: SortConfig | null;
  onToggle: (key: string) => void;
  className?: string;
}

export function SortableHeader({ label, sortKey, current, onToggle, className }: SortableHeaderProps) {
  const isActive = current?.key === sortKey;
  return (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground transition-colors ${className || ""}`}
      onClick={() => onToggle(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          current.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}

/* ── Parse logo info from colorLabel ── */
export function parseLogoInfo(colorLabel: string): string {
  const m = colorLabel.match(/\(([^)]+)\)/);
  return m ? m[1] : "–";
}

/* ── Pure color (without parentheses) ── */
export function parseColor(colorLabel: string): string {
  return colorLabel.replace(/\s*\([^)]*\)/, "").trim();
}

/* ── CSV export ── */
export function downloadCsv(headers: string[], rows: string[][], filename: string) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(";"), ...rows.map((r) => r.map(escape).join(";"))];
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
