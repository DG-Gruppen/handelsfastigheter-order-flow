import React, { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PersistedState {
  rect: Rect;
  maximized: boolean;
}

const MIN_W = 380;
const MIN_H = 420;
const MARGIN = 8;

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RESIZE_HANDLES: { dir: ResizeDir; className: string }[] = [
  { dir: "n", className: "top-0 left-2 right-2 h-1.5 cursor-ns-resize" },
  { dir: "s", className: "bottom-0 left-2 right-2 h-1.5 cursor-ns-resize" },
  { dir: "e", className: "right-0 top-2 bottom-2 w-1.5 cursor-ew-resize" },
  { dir: "w", className: "left-0 top-2 bottom-2 w-1.5 cursor-ew-resize" },
  { dir: "ne", className: "top-0 right-0 h-3 w-3 cursor-nesw-resize" },
  { dir: "nw", className: "top-0 left-0 h-3 w-3 cursor-nwse-resize" },
  { dir: "se", className: "bottom-0 right-0 h-3 w-3 cursor-nwse-resize" },
  { dir: "sw", className: "bottom-0 left-0 h-3 w-3 cursor-nesw-resize" },
];

function defaultRect(): Rect {
  const w = Math.min(window.innerWidth - 2 * MARGIN, 760);
  const h = Math.min(Math.round(window.innerHeight * 0.8), 660);
  return {
    x: window.innerWidth - w - 16,
    y: window.innerHeight - h - 24,
    w,
    h,
  };
}

function clampRect(r: Rect): Rect {
  const w = Math.min(Math.max(r.w, MIN_W), window.innerWidth - 2 * MARGIN);
  const h = Math.min(Math.max(r.h, MIN_H), window.innerHeight - 2 * MARGIN);
  const x = Math.min(Math.max(r.x, MARGIN), window.innerWidth - w - MARGIN);
  const y = Math.min(Math.max(r.y, MARGIN), window.innerHeight - h - MARGIN);
  return { x, y, w, h };
}

function loadState(storageKey: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (typeof parsed?.rect?.w !== "number") return null;
    return { rect: clampRect(parsed.rect), maximized: !!parsed.maximized };
  } catch {
    return null;
  }
}

/**
 * Draggable + resizable floating window (WhatsApp Desktop-style) with
 * maximize/restore and persisted position/size. Falls back to a fullscreen
 * sheet on mobile where drag/resize makes no sense.
 */
export function FloatingWindow({
  title,
  icon,
  onClose,
  storageKey = "shf-chat-window",
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  storageKey?: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [rect, setRect] = useState<Rect>(() => loadState(storageKey)?.rect ?? clampRect(defaultRect()));
  const [maximized, setMaximized] = useState<boolean>(() => loadState(storageKey)?.maximized ?? false);
  const [interacting, setInteracting] = useState(false);
  const rectRef = useRef(rect);
  rectRef.current = rect;

  const persist = useCallback(
    (r: Rect, max: boolean) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ rect: r, maximized: max }));
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  );

  // Keep the window inside the viewport when the browser is resized
  useEffect(() => {
    const onResize = () => setRect(r => clampRect(r));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggleMaximize = useCallback(() => {
    setMaximized(m => {
      persist(rectRef.current, !m);
      return !m;
    });
  }, [persist]);

  const startDrag = (e: React.PointerEvent) => {
    if (maximized) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = rectRef.current;
    setInteracting(true);
    const onMove = (ev: PointerEvent) => {
      setRect(clampRect({ ...start, x: start.x + ev.clientX - startX, y: start.y + ev.clientY - startY }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setInteracting(false);
      persist(rectRef.current, false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startResize = (dir: ResizeDir) => (e: React.PointerEvent) => {
    if (maximized) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = rectRef.current;
    setInteracting(true);
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let { x, y, w, h } = start;
      if (dir.includes("e")) w = start.w + dx;
      if (dir.includes("s")) h = start.h + dy;
      if (dir.includes("w")) {
        w = start.w - dx;
        x = start.x + Math.min(dx, start.w - MIN_W);
      }
      if (dir.includes("n")) {
        h = start.h - dy;
        y = start.y + Math.min(dy, start.h - MIN_H);
      }
      setRect(clampRect({ x, y, w, h }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setInteracting(false);
      persist(rectRef.current, false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const style: React.CSSProperties = isMobile
    ? { inset: "0.5rem 0.5rem 4.5rem 0.5rem" }
    : maximized
    ? { inset: `${MARGIN}px` }
    : { left: rect.x, top: rect.y, width: rect.w, height: rect.h };

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden",
        !interacting && "transition-[inset] duration-150"
      )}
      style={style}
      role="dialog"
      aria-label={title}
    >
      {/* Title bar — drag handle + window controls */}
      <div
        onPointerDown={isMobile ? undefined : startDrag}
        onDoubleClick={isMobile ? undefined : toggleMaximize}
        className={cn(
          "h-9 px-3 flex items-center gap-2 bg-muted/70 border-b border-border select-none shrink-0",
          !isMobile && !maximized && "cursor-grab active:cursor-grabbing"
        )}
      >
        {icon}
        <span className="text-sm font-semibold truncate flex-1">{title}</span>
        {!isMobile && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={toggleMaximize}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={maximized ? "Återställ storlek" : "Maximera"}
            title={maximized ? "Återställ" : "Maximera"}
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        )}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Stäng chatt"
          title="Stäng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0">{children}</div>

      {/* Resize handles */}
      {!isMobile &&
        !maximized &&
        RESIZE_HANDLES.map(h => (
          <div key={h.dir} onPointerDown={startResize(h.dir)} className={cn("absolute z-10", h.className)} />
        ))}
    </div>
  );
}
