import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import planContent from "../../docs/offboarding-plan.md?raw";
import { FileText } from "lucide-react";

export default function OffboardingPlan() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            Offboarding-plan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Levande planeringsdokument. Speglar{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-foreground/80 text-xs">
              docs/offboarding-plan.md
            </code>{" "}
            — uppdateras automatiskt när filen ändras.
          </p>
        </div>
      </div>

      <article
        className="
          bg-card rounded-lg border border-border p-6 md:p-10
          prose prose-sm md:prose-base max-w-none
          prose-headings:font-heading prose-headings:text-foreground
          prose-h1:text-3xl prose-h1:mt-0 prose-h1:mb-6 prose-h1:pb-3 prose-h1:border-b prose-h1:border-border
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-primary
          prose-h3:text-base prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-foreground/90
          prose-p:text-foreground/85 prose-p:leading-relaxed
          prose-li:text-foreground/85 prose-li:marker:text-accent
          prose-strong:text-foreground prose-strong:font-semibold
          prose-a:text-accent prose-a:no-underline hover:prose-a:underline
          prose-code:text-accent prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5
          prose-code:rounded prose-code:text-[0.85em] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:text-foreground
          prose-blockquote:border-l-accent prose-blockquote:bg-accent/5 prose-blockquote:py-1
          prose-blockquote:text-foreground/80 prose-blockquote:not-italic
          prose-hr:border-border
        "
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ children }) => (
              <div className="overflow-x-auto -mx-2 my-4">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-muted/60">{children}</thead>
            ),
            th: ({ children }) => (
              <th className="text-left px-3 py-2 border border-border font-semibold text-foreground">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 border border-border text-foreground/85 align-top">
                {children}
              </td>
            ),
          }}
        >
          {planContent}
        </ReactMarkdown>
      </article>
    </div>
  );
}
