import { useState, useEffect, lazy, Suspense } from "react";
import { MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Chat = lazy(() => import("@/pages/Chat"));

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    supabase
      .from("org_chart_settings")
      .select("setting_value")
      .eq("setting_key", "chat_enabled")
      .maybeSingle()
      .then(({ data }) => {
        setEnabled(data?.setting_value !== "false");
      });
  }, []);

  if (!enabled || !user) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-20 md:right-24 z-50 h-11 w-11 md:h-14 md:w-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 border border-border"
          aria-label="Öppna chatt"
        >
          <MessageSquare className="h-5 w-5 md:h-6 md:w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 md:bottom-6 right-4 z-50 rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          style={{
            width: "min(calc(100vw - 2rem), 700px)",
            height: "min(80vh, 640px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Chatt</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-md hover:bg-accent flex items-center justify-center"
              aria-label="Stäng chatt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Chat content */}
          <div className="flex-1 min-h-0">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              }
            >
              <Chat embedded />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}
