/**
 * Enkel fritextsökning med wildcard-stöd.
 * - `*` matchar valfritt antal tecken, `?` matchar ett tecken
 * - flera ord = AND (alla termer måste matcha någonstans i fälten)
 * - skiftlägesokänslig och okänslig för accenter
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u0336]/g, "");
}

function termToRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === "*" || m === "?" ? m : "\\" + m));
  const pattern = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(pattern);
}

export type Matcher = (fields: (string | null | undefined)[]) => boolean;

/** Returnerar en matchningsfunktion. Tom sökning matchar allt. */
export function makeMatcher(query: string): Matcher {
  const terms = norm(query).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return () => true;
  const regexes = terms.map(termToRegex);
  return (fields) => {
    const hay = fields.filter(Boolean).map((f) => norm(String(f))).join(" | ");
    return regexes.every((re) => re.test(hay));
  };
}
