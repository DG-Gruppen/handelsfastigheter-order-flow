// Extracts {{variable}} tokens from a prompt body, preserving order, deduplicated.
export function extractVariables(body: string): string[] {
  const matches = body.matchAll(/\{\{\s*([a-zA-ZåäöÅÄÖ0-9_-]+)\s*\}\}/g);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const key = m[1];
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

export function fillVariables(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-ZåäöÅÄÖ0-9_-]+)\s*\}\}/g, (_, key) => {
    const v = values[key];
    return v && v.trim() !== "" ? v : `{{${key}}}`;
  });
}

export const PROMPT_CATEGORIES = [
  "Avtal",
  "Ekonomi",
  "Hållbarhet/Energi",
  "Marknadsföring",
  "Teknik",
  "Uthyrning",
  "Övrigt",
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

// Tailwind classes per category (light + dark friendly badges)
export const CATEGORY_BADGE: Record<string, string> = {
  Avtal: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Ekonomi: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  "Hållbarhet/Energi": "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
  Marknadsföring: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  Teknik: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  Uthyrning: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  Övrigt: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};
