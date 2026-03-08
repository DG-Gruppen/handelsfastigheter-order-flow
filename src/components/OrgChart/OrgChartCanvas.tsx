/**
 * OrgChartCanvas — Interactive SVG org chart
 *
 * Blueprint logic (computeLayout, buildConnectorSegments, drag-drop, pan/zoom)
 * is preserved 100% from the Claude blueprint.
 * Visual design uses the app's design tokens from index.css.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ZoomIn, ZoomOut, Maximize, Minimize2, Expand } from "lucide-react";

// ─── TYPES ───────────────────────────────────────────────────────────────────
export type NodeType = "root" | "staff" | "line";
export type DropAction = "move_under" | "swap" | "place_above";

export interface OrgNode {
  id: string;
  userId?: string;
  name: string;
  position: string;
  dept: string;
  avatar: string;
  color: string;   // design token key
  type: NodeType;
  children: OrgNode[];
}

interface DropMenuState {
  dragId: string;
  targetId: string;
  screenX: number;
  screenY: number;
}

interface Pos { x: number; y: number; w: number; h: number; }
interface Segment { type: "vs"|"sh"|"sd"|"lh"|"ld"; x1: number; y1: number; x2: number; y2: number; }

// ─── LAYOUT CONSTANTS ────────────────────────────────────────────────────────
const CARD = {
  ROOT:  { W: 228, H: 74,  R: 14 },
  STAFF: { W: 182, H: 60,  R: 10 },
  LINE:  { W: 192, H: 66,  R: 11 },
  EMP:   { W: 168, H: 58,  R: 9  },
};

const GAP_H            = 28;
const GAP_V            = 110;
const GAP_V_STACK      = 16;  // vertical gap between stacked employees
const STAFF_GAP_V      = 100;
const LINE_AFTER_STAFF = 160;

function isLeafNode(node: OrgNode): boolean {
  return node.children.length === 0 && node.color === "muted";
}

function allChildrenAreLeaves(node: OrgNode): boolean {
  const lineKids = node.children.filter(c => c.type !== "staff");
  return lineKids.length > 0 && lineKids.every(c => isLeafNode(c));
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.0;

// ─── TREE UTILITIES (from blueprint — unchanged) ─────────────────────────────
const deepClone = (n: OrgNode): OrgNode => JSON.parse(JSON.stringify(n));

function findNode(tree: OrgNode, id: string): OrgNode | null {
  if (tree.id === id) return tree;
  for (const c of tree.children) { const r = findNode(c, id); if (r) return r; }
  return null;
}

function findParent(tree: OrgNode, id: string, par: OrgNode | null = null): OrgNode | null | undefined {
  if (tree.id === id) return par;
  for (const c of tree.children) { const r = findParent(c, id, tree); if (r !== undefined) return r; }
  return undefined;
}

function removeNode(tree: OrgNode, id: string): [OrgNode | null, OrgNode | null] {
  if (tree.id === id) return [null, tree];
  const ch: OrgNode[] = []; let rem: OrgNode | null = null;
  for (const c of tree.children) {
    const [nc, r] = removeNode(c, id);
    if (r) rem = r;
    if (nc) ch.push(nc);
  }
  return [{ ...tree, children: ch }, rem];
}

function insertNode(tree: OrgNode, targetId: string, node: OrgNode): OrgNode {
  if (tree.id === targetId) return { ...tree, children: [...tree.children, node] };
  return { ...tree, children: tree.children.map(c => insertNode(c, targetId, node)) };
}

function isAncestor(tree: OrgNode, ancId: string, nodeId: string): boolean {
  const n = findNode(tree, ancId);
  return n ? !!findNode(n, nodeId) : false;
}

function swapNodes(tree: OrgNode, idA: string, idB: string): OrgNode {
  // Swap two nodes: A goes where B was, B goes where A was
  const cl = deepClone(tree);
  const nodeA = findNode(cl, idA);
  const nodeB = findNode(cl, idB);
  if (!nodeA || !nodeB) return cl;

  const parentA = findParent(cl, idA);
  const parentB = findParent(cl, idB);
  if (!parentA || !parentB) return cl;

  const idxA = parentA.children.findIndex(c => c.id === idA);
  const idxB = parentB.children.findIndex(c => c.id === idB);
  if (idxA === -1 || idxB === -1) return cl;

  // Swap in parent arrays (keep each node's own children intact)
  parentA.children[idxA] = nodeB;
  parentB.children[idxB] = nodeA;

  return cl;
}

function placeAbove(tree: OrgNode, movedId: string, targetId: string): OrgNode {
  const cl = deepClone(tree);
  const [without, removed] = removeNode(cl, movedId);
  if (!removed || !without) return tree;

  const targetParent = findParent(without, targetId);
  if (!targetParent) return tree;

  const idx = targetParent.children.findIndex(c => c.id === targetId);
  if (idx === -1) return tree;

  const target = targetParent.children[idx];
  removed.children.push(target);
  targetParent.children[idx] = removed;

  return without;
}

function collectIds(node: OrgNode, set = new Set<string>()): Set<string> {
  set.add(node.id);
  node.children.forEach(c => collectIds(c, set));
  return set;
}

function countDescendants(node: OrgNode): number {
  let n = 0;
  const go = (nd: OrgNode) => { n += nd.children.length; nd.children.forEach(go); };
  go(node);
  return n;
}

function cardDims(node: OrgNode) {
  if (node.type === "root")  return CARD.ROOT;
  if (node.type === "staff") return CARD.STAFF;
  if (node.color === "muted") return CARD.EMP;
  return CARD.LINE;
}

// ─── LAYOUT ENGINE (from blueprint — unchanged) ─────────────────────────────
function computeLayout(tree: OrgNode, collapsed: Set<string>): Map<string, Pos> {
  const pos = new Map<string, Pos>();

  function subtreeW(node: OrgNode): number {
    if (collapsed.has(node.id)) return cardDims(node).W;
    const kids = node.children.filter(c => c.type !== "staff");
    if (!kids.length) return cardDims(node).W;
    // If all children are leaves, they stack vertically → width is just the widest card
    if (allChildrenAreLeaves(node)) {
      const maxChildW = Math.max(...kids.map(c => cardDims(c).W));
      return Math.max(cardDims(node).W, maxChildW);
    }
    const total = kids.reduce((s, c) => s + subtreeW(c), 0) + GAP_H * (kids.length - 1);
    return Math.max(cardDims(node).W, total);
  }

  function place(node: OrgNode, centerX: number, top: number) {
    const { W, H } = cardDims(node);
    pos.set(node.id, { x: centerX - W / 2, y: top, w: W, h: H });
    if (collapsed.has(node.id)) return;

    const staffKids = node.children.filter(c => c.type === "staff");
    const lineKids  = node.children.filter(c => c.type !== "staff");

    if (staffKids.length && node.type === "root") {
      const staffTop = top + H + STAFF_GAP_V;
      const SIDE_OFFSET = 180; // distance from center to each staff node center
      if (staffKids.length === 1) {
        // Single staff node to the right
        pos.set(staffKids[0].id, { x: centerX + SIDE_OFFSET - CARD.STAFF.W / 2, y: staffTop, w: CARD.STAFF.W, h: CARD.STAFF.H });
      } else {
        // Spread symmetrically: left half to the left, right half to the right
        const half = Math.ceil(staffKids.length / 2);
        staffKids.forEach((s, i) => {
          const side = i < half ? -1 : 1;
          const indexInSide = i < half ? (half - 1 - i) : (i - half);
          const offset = SIDE_OFFSET + indexInSide * (CARD.STAFF.W + GAP_H);
          pos.set(s.id, { x: centerX + side * offset - CARD.STAFF.W / 2, y: staffTop, w: CARD.STAFF.W, h: CARD.STAFF.H });
        });
      }
    }

    if (!lineKids.length) return;

    let lineTop: number;
    if (node.type === "root" && staffKids.length) {
      lineTop = top + H + STAFF_GAP_V + CARD.STAFF.H + LINE_AFTER_STAFF;
    } else {
      lineTop = top + H + GAP_V;
    }

    // If all children are leaves, stack them vertically
    if (allChildrenAreLeaves(node)) {
      let curY = lineTop;
      lineKids.forEach(child => {
        const { W: cW, H: cH } = cardDims(child);
        pos.set(child.id, { x: centerX - cW / 2, y: curY, w: cW, h: cH });
        curY += cH + GAP_V_STACK;
      });
      return;
    }

    const totalW = lineKids.reduce((s, c) => s + subtreeW(c), 0) + GAP_H * (lineKids.length - 1);
    let childX = centerX - totalW / 2;
    lineKids.forEach(child => {
      const sw = subtreeW(child);
      place(child, childX + sw / 2, lineTop);
      childX += sw + GAP_H;
    });
  }

  place(tree, 0, 0);
  return pos;
}

// ─── CONNECTOR SEGMENTS (from blueprint — unchanged) ─────────────────────────
function buildConnectorSegments(tree: OrgNode, positions: Map<string, Pos>, collapsed: Set<string>): Segment[] {
  const segments: Segment[] = [];
  const push = (type: Segment["type"], x1: number, y1: number, x2: number, y2: number) =>
    segments.push({ type, x1, y1, x2, y2 });

  function draw(node: OrgNode) {
    if (collapsed.has(node.id)) return;
    const p = positions.get(node.id);
    if (!p) return;

    const px = p.x + p.w / 2;
    const py = p.y + p.h;

    const staff = node.children.filter(c => c.type === "staff");
    const line  = node.children.filter(c => c.type !== "staff");

    if (node.type === "root" && staff.length) {
      const sps = staff.map(s => positions.get(s.id)).filter(Boolean) as Pos[];
      if (sps.length) {
        const staffTopY = sps[0].y;
        const barY = py + (staffTopY - py) / 2;

        // Dashed horizontal segments from center to each staff node (not one continuous bar)
        sps.forEach(sp => {
          const scx = sp.x + sp.w / 2;
          push("sh", px, barY, scx, barY);  // dashed horizontal from center to staff
          push("sd", scx, barY, scx, sp.y); // dashed vertical down to staff card
        });

        if (line.length) {
          const lps = line.map(l => positions.get(l.id)).filter(Boolean) as Pos[];
          if (lps.length) {
            const lineTopY = lps[0].y;
            const lBarY = barY + (lineTopY - barY) / 2;
            const lAllX = lps.map(lp => lp.x + lp.w / 2);
            // Solid vertical: VD bottom all the way to manager bar (continuous through barY)
            push("vs", px, py, px, lBarY);
            if (line.length > 1) push("lh", Math.min(...lAllX), lBarY, Math.max(...lAllX), lBarY);
            lps.forEach(lp => push("ld", lp.x + lp.w / 2, lBarY, lp.x + lp.w / 2, lp.y));
          }
        } else {
          // No line kids, just draw solid vertical to barY
          push("vs", px, py, px, barY);
        }
      }
    } else if (line.length) {
      // Check if children are stacked vertically
      if (allChildrenAreLeaves(node)) {
        // Draw a single vertical line from parent down through all stacked children
        const lps = line.map(l => positions.get(l.id)).filter(Boolean) as Pos[];
        if (lps.length) {
          // Vertical stem from parent to first child
          push("vs", px, py, px, lps[0].y);
          // Vertical lines between consecutive stacked children
          for (let i = 0; i < lps.length - 1; i++) {
            const cx = lps[i].x + lps[i].w / 2;
            push("vs", cx, lps[i].y + lps[i].h, cx, lps[i + 1].y);
          }
        }
      } else {
        const lps = line.map(l => positions.get(l.id)).filter(Boolean) as Pos[];
        if (lps.length) {
          const lineTopY = lps[0].y;
          const barY = py + (lineTopY - py) / 2;
          const lAllX = lps.map(lp => lp.x + lp.w / 2);
          push("vs", px, py, px, barY);
          if (line.length > 1) push("lh", Math.min(...lAllX), barY, Math.max(...lAllX), barY);
          lps.forEach(lp => push("ld", lp.x + lp.w / 2, barY, lp.x + lp.w / 2, lp.y));
        }
      }
    }

    line.forEach(c => draw(c));
  }

  draw(tree);
  return segments;
}

// ─── CONNECTORS SVG COMPONENT ────────────────────────────────────────────────
function Connectors({ tree, positions, collapsed }: {
  tree: OrgNode; positions: Map<string, Pos>; collapsed: Set<string>;
}) {
  const segments = useMemo(
    () => buildConnectorSegments(tree, positions, collapsed),
    [tree, positions, collapsed]
  );

  return (
    <g>
      {/* Draw dashed (staff) lines first */}
      {segments.filter(s => s.type === "sh" || s.type === "sd").map((s, i) => (
        <line
          key={`staff-${i}`}
          x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke="hsl(250, 80%, 65%)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="5 4"
          opacity={0.6}
        />
      ))}
      {/* Draw solid lines on top so they're always visible */}
      {segments.filter(s => s.type !== "sh" && s.type !== "sd").map((s, i) => (
        <line
          key={`solid-${i}`}
          x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke="hsl(225, 12%, 48%)"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.7}
        />
      ))}
      {/* Junction dots */}
      {segments.filter(s => s.type === "ld" || s.type === "sd").map((s, i) => (
        <circle
          key={`dot-${i}`}
          cx={s.x1} cy={s.y1} r={2.5}
          fill={s.type === "sd" ? "hsl(250, 80%, 65%)" : "hsl(225, 12%, 48%)"}
          opacity={0.6}
        />
      ))}
    </g>
  );
}

// ─── COLOR MAP (maps node.color to HSL values from our design tokens) ────────
const COLOR_MAP: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  primary: {
    bg: "hsl(230, 75%, 55%)",
    border: "hsl(230, 75%, 65%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(230, 75%, 75%)",
  },
  accent: {
    bg: "hsl(250, 80%, 65%)",
    border: "hsl(250, 80%, 75%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(250, 80%, 80%)",
  },
  blue: {
    bg: "hsl(230, 75%, 55%)",
    border: "hsl(230, 75%, 65%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(230, 75%, 75%)",
  },
  green: {
    bg: "hsl(165, 55%, 42%)",
    border: "hsl(165, 55%, 52%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(165, 55%, 62%)",
  },
  amber: {
    bg: "hsl(38, 92%, 50%)",
    border: "hsl(38, 92%, 60%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(38, 92%, 70%)",
  },
  muted: {
    bg: "hsl(230, 22%, 16%)",
    border: "hsl(230, 22%, 24%)",
    text: "hsl(225, 12%, 85%)",
    accent: "hsl(225, 12%, 52%)",
  },
};

function getColors(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.muted;
}

// ─── COLLAPSE BUTTON (from blueprint logic, styled with tokens) ──────────────
function CollapseButton({ pos, collapsed, count, onClick }: {
  pos: Pos; collapsed: boolean; count: number; onClick: () => void;
}) {
  const bx = pos.x + pos.w / 2;
  const by = pos.y + pos.h + 11;
  const bw = collapsed ? Math.max(32, String(count).length * 8 + 22) : 22;
  const bh = 16;

  return (
    <g style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); onClick(); }}>
      <rect
        x={bx - bw / 2} y={by - bh / 2} width={bw} height={bh} rx={bh / 2}
        fill="hsl(230, 25%, 11%)"
        stroke="hsl(230, 22%, 24%)"
        strokeWidth={1}
      />
      <text
        x={bx} y={by + 0.5}
        textAnchor="middle" dominantBaseline="central"
        fontSize={collapsed ? 8 : 11}
        fill="hsl(225, 12%, 52%)"
        fontFamily="var(--font-body)"
        fontWeight="600"
      >
        {collapsed ? `+${count}` : "−"}
      </text>
    </g>
  );
}

// ─── NODE CARD (styled with our design tokens) ──────────────────────────────
function NodeCard({ node, pos, isDragging, isDropTarget, onMouseDown }: {
  node: OrgNode; pos: Pos; isDragging: boolean; isDropTarget: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}) {
  const { x, y, w, h } = pos;
  const c = getColors(node.color);
  const dims = cardDims(node);

  const fillColor = isDropTarget ? "hsl(230, 75%, 20%)" : "hsl(230, 25%, 11%)";
  const strokeColor = isDropTarget ? "hsl(230, 75%, 60%)" : c.border;

  return (
    <g
      data-org-card="true"
      style={{
        cursor: node.type === "root" ? "default" : "grab",
        opacity: isDragging ? 0.15 : 1,
      }}
      onMouseDown={node.type === "root" ? undefined : onMouseDown}
    >
      {/* Card background */}
      <rect
        x={x} y={y} width={w} height={h} rx={dims.R}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isDropTarget ? 2 : 1.5}
      />

      {/* Color accent bar on left */}
      <rect
        x={x} y={y} width={4} height={h}
        rx={2}
        fill={c.bg}
      />

      {/* Avatar circle */}
      <circle
        cx={x + 24} cy={y + h / 2}
        r={node.type === "root" ? 16 : 13}
        fill={c.bg}
        opacity={0.2}
      />
      <text
        x={x + 24} y={y + h / 2 + 1}
        textAnchor="middle" dominantBaseline="central"
        fontSize={node.type === "root" ? 11 : 9}
        fontWeight="700"
        fill={c.bg}
        fontFamily="var(--font-heading)"
      >
        {node.avatar}
      </text>

      {/* Name */}
      <text
        x={x + (node.type === "root" ? 48 : 44)}
        y={y + h / 2 - (node.dept ? 7 : 0)}
        fontSize={node.type === "root" ? 13 : 11}
        fontWeight="700"
        fill="hsl(225, 12%, 93%)"
        fontFamily="var(--font-heading)"
      >
        {node.name}
      </text>

      {/* Position / title */}
      <text
        x={x + (node.type === "root" ? 48 : 44)}
        y={y + h / 2 + 7}
        fontSize={node.type === "root" ? 10 : 8}
        fill="hsl(225, 12%, 52%)"
        fontFamily="var(--font-body)"
      >
        {node.position}
      </text>

      {/* Dept label */}
      {node.dept && node.type !== "staff" && (
        <text
          x={x + w - 8}
          y={y + h - 8}
          textAnchor="end"
          fontSize={7}
          fill="hsl(225, 12%, 40%)"
          fontFamily="var(--font-body)"
        >
          {node.dept}
        </text>
      )}

      {/* Staff label */}
      {node.type === "staff" && (
        <text
          x={x + w - 8} y={y + 10}
          fontSize={7} textAnchor="end"
          fill={c.bg}
          fontFamily="var(--font-heading)"
          fontWeight="700"
        >
          STAB
        </text>
      )}

      {/* Drop target glow */}
      {isDropTarget && (
        <rect
          x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={dims.R + 2}
          fill="none"
          stroke="hsl(230, 75%, 60%)"
          strokeWidth={1}
          opacity={0.4}
        />
      )}
    </g>
  );
}

// ─── DROP ACTION MENU ────────────────────────────────────────────────────────
import { ArrowDown, ArrowUpDown, ArrowUp } from "lucide-react";

function DropActionMenu({ menu, tree, onAction, onClose }: {
  menu: DropMenuState;
  tree: OrgNode;
  onAction: (action: DropAction) => void;
  onClose: () => void;
}) {
  const dragNode = findNode(tree, menu.dragId);
  const targetNode = findNode(tree, menu.targetId);
  if (!dragNode || !targetNode) return null;

  const canSwap = targetNode.type !== "root";
  const canPlaceAbove = targetNode.type !== "root" && !isAncestor(tree, menu.dragId, menu.targetId);

  const actions: { key: DropAction; label: string; desc: string; icon: React.ReactNode; enabled: boolean }[] = [
    {
      key: "move_under",
      label: "Flytta under",
      desc: `${dragNode.name} blir underställd ${targetNode.name}`,
      icon: <ArrowDown className="h-4 w-4" />,
      enabled: true,
    },
    {
      key: "swap",
      label: "Byt plats",
      desc: `${dragNode.name} och ${targetNode.name} byter position`,
      icon: <ArrowUpDown className="h-4 w-4" />,
      enabled: canSwap,
    },
    {
      key: "place_above",
      label: "Placera ovanför",
      desc: `${dragNode.name} tar ${targetNode.name}s plats, som blir underställd`,
      icon: <ArrowUp className="h-4 w-4" />,
      enabled: canPlaceAbove,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[10000]"
      onClick={onClose}
    >
      <div
        className="absolute z-[10001]"
        style={{ left: menu.screenX, top: menu.screenY, transform: "translate(-50%, -50%)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden min-w-[220px]">
          <div className="px-3 py-2 border-b border-border/40">
            <p className="text-xs font-semibold text-foreground">Välj åtgärd</p>
          </div>
          <div className="p-1">
            {actions.filter(a => a.enabled).map(a => (
              <button
                key={a.key}
                onClick={() => onAction(a.key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/80 transition-colors text-left group"
              >
                <span className="text-muted-foreground group-hover:text-primary transition-colors">
                  {a.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DragGhost({ node, x, y }: { node: OrgNode; x: number; y: number }) {
  if (!node) return null;
  const { W, H } = cardDims(node);
  const c = getColors(node.color);
  return (
    <div style={{
      position: "fixed", left: x, top: y, pointerEvents: "none", zIndex: 9999,
      transform: "translate(-50%, -50%) rotate(4deg) scale(1.05)",
    }}>
      <div style={{
        width: W, height: H, borderRadius: 10,
        background: "hsl(230, 25%, 14%)",
        border: `1.5px solid ${c.bg}`,
        display: "flex", alignItems: "center", padding: "0 14px", gap: 10,
        opacity: 0.9,
        boxShadow: `0 8px 32px hsla(230, 75%, 55%, 0.3)`,
      }}>
        <span style={{
          fontWeight: 700, color: "hsl(225, 12%, 93%)", fontSize: 12,
          fontFamily: "var(--font-heading)",
        }}>{node.position}</span>
        <span style={{
          color: "hsl(225, 12%, 52%)", fontSize: 10,
          fontFamily: "var(--font-body)",
        }}>{node.name}</span>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
interface OrgChartCanvasProps {
  initialTree: OrgNode;
  onMoveNode?: (movedNodeId: string, newParentId: string, action: DropAction) => void;
}

export default function OrgChartCanvas({ initialTree, onMoveNode }: OrgChartCanvasProps) {
  const [tree, setTree]             = useState(initialTree);
  const [collapsed, setCollapsed]   = useState(new Set<string>());
  const [drag, setDrag]             = useState<{ id: string; curX: number; curY: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dropMenu, setDropMenu]     = useState<DropMenuState | null>(null);
  const [zoom, setZoom]             = useState(1);
  const [pan, setPan]               = useState({ x: 0, y: 0 });

  const vpRef   = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; curX: number; curY: number } | null>(null);
  const dropRef = useRef<string | null>(null);
  const panRef  = useRef<{ panning: boolean; start: any }>({ panning: false, start: {} });
  const zoomRef = useRef(zoom);   zoomRef.current = zoom;
  const panXY   = useRef(pan);    panXY.current   = pan;
  const treeRef = useRef(tree);   treeRef.current = tree;

  useEffect(() => { setTree(initialTree); }, [initialTree]);

  // ── Layout ──
  const positions = useMemo(() => computeLayout(tree, collapsed), [tree, collapsed]);

  const { minX, minY, svgW, svgH } = useMemo(() => {
    let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
    for (const [, p] of positions) {
      mnX = Math.min(mnX, p.x - 40); mnY = Math.min(mnY, p.y - 40);
      mxX = Math.max(mxX, p.x + p.w + 40); mxY = Math.max(mxY, p.y + p.h + 40);
    }
    return { minX: mnX, minY: mnY, svgW: mxX - mnX, svgH: mxY - mnY };
  }, [positions]);

  const collapsedDescendants = useMemo(() => {
    const s = new Set<string>();
    for (const id of collapsed) {
      const n = findNode(tree, id);
      if (n) n.children.forEach(c => collectIds(c, s));
    }
    return s;
  }, [collapsed, tree]);

  const ghostIds = useMemo(() => {
    if (!drag) return new Set<string>();
    const n = findNode(tree, drag.id);
    return n ? collectIds(n, new Set()) : new Set<string>();
  }, [drag, tree]);

  // ── Center on mount ──
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const { width } = vp.getBoundingClientRect();
    setPan({ x: (width - svgW) / 2, y: 60 });
  }, []); // eslint-disable-line

  // ── Collapse / expand ──
  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  const collapseAll = useCallback(() => {
    const s = new Set<string>();
    const go = (n: OrgNode) => { if (n.children.length) { s.add(n.id); n.children.forEach(go); } };
    go(tree);
    setCollapsed(s);
  }, [tree]);

  // ── Zoom ──
  const applyZoom = useCallback((newZ: number, focalX?: number, focalY?: number) => {
    const vp = vpRef.current?.getBoundingClientRect();
    const ox = focalX ?? (vp ? vp.width / 2 : 0);
    const oy = focalY ?? (vp ? vp.height / 2 : 0);
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZ));
    setPan(p => ({
      x: ox - (ox - p.x) * (z / zoomRef.current),
      y: oy - (oy - p.y) * (z / zoomRef.current),
    }));
    setZoom(z);
  }, []);

  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (dragRef.current) return;
      e.preventDefault();
      const vr = el.getBoundingClientRect();
      applyZoom(zoomRef.current * (1 - e.deltaY * 0.001), e.clientX - vr.left, e.clientY - vr.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  // ── Pan ──
  const onViewportMouseDown = useCallback((e: React.MouseEvent) => {
    // Allow panning with middle mouse or left-click on any non-interactive element
    const target = e.target as HTMLElement | SVGElement;
    const isCard = target.closest("[data-org-card]");
    if (e.button === 1 || (e.button === 0 && !isCard)) {
      e.preventDefault();
      panRef.current = {
        panning: true,
        start: { mx: e.clientX, my: e.clientY, px: panXY.current.x, py: panXY.current.y },
      };
    }
  }, []);

  // ── Drag-and-drop (from blueprint — unchanged logic) ──
  const screenToCanvas = useCallback((sx: number, sy: number) => {
    const vp = vpRef.current?.getBoundingClientRect();
    if (!vp) return { x: 0, y: 0 };
    return {
      x: (sx - vp.left - panXY.current.x) / zoomRef.current + minX,
      y: (sy - vp.top  - panXY.current.y) / zoomRef.current + minY,
    };
  }, [minX, minY]);

  const findDropTargetFn = useCallback((sx: number, sy: number, dragId: string) => {
    const { x: cx, y: cy } = screenToCanvas(sx, sy);
    let best: string | null = null, bestDist = Infinity;
    for (const [id, p] of positions) {
      if (id === dragId) continue;
      if (isAncestor(treeRef.current, dragId, id)) continue;
      if (collapsedDescendants.has(id)) continue;
      const parent = findParent(treeRef.current, dragId);
      if (parent && parent.id === id) continue;
      // Can't drop on staff nodes
      const targetNode = findNode(treeRef.current, id);
      if (targetNode?.type === "staff") continue;
      const dist = Math.hypot(cx - (p.x + p.w / 2), cy - (p.y + p.h / 2));
      if (dist < bestDist) { bestDist = dist; best = id; }
    }
    const SNAP_DISTANCE = 140;
    return bestDist < SNAP_DISTANCE ? best : null;
  }, [positions, collapsedDescendants, screenToCanvas]);

  const onCardMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0 || nodeId === treeRef.current.id) return;
    e.preventDefault();
    e.stopPropagation();
    const s = { id: nodeId, curX: e.clientX, curY: e.clientY };
    dragRef.current = s;
    setDrag(s);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (panRef.current.panning) {
        const { start } = panRef.current;
        setPan({ x: start.px + e.clientX - start.mx, y: start.py + e.clientY - start.my });
        return;
      }
      if (!dragRef.current) return;
      const updated = { ...dragRef.current, curX: e.clientX, curY: e.clientY };
      dragRef.current = updated;
      setDrag({ ...updated });
      const dt = findDropTargetFn(e.clientX, e.clientY, updated.id);
      dropRef.current = dt;
      setDropTarget(dt);
    };

    const onUp = (e: MouseEvent) => {
      if (panRef.current.panning) { panRef.current = { panning: false, start: {} }; return; }
      if (!dragRef.current) return;

      const { id } = dragRef.current;
      const dt = dropRef.current;

      if (dt && dt !== id) {
        // Show drop action menu instead of immediately moving
        setDropMenu({ dragId: id, targetId: dt, screenX: e.clientX, screenY: e.clientY });
      }

      dragRef.current = null;
      dropRef.current = null;
      setDrag(null);
      setDropTarget(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [findDropTargetFn, onMoveNode]);

  // ── Snap line ──
  const snapLine = useMemo(() => {
    if (!drag || !dropTarget) return null;
    const dragP = positions.get(drag.id);
    const targetP = positions.get(dropTarget);
    if (!targetP || !dragP) return null;
    // Line from dragged card center to target card center
    const sx = dragP.x + dragP.w / 2, sy = dragP.y + dragP.h / 2;
    const tx = targetP.x + targetP.w / 2, ty = targetP.y + targetP.h / 2;
    return { sx, sy, tx, ty };
  }, [drag, dropTarget, positions]);

  const dragNode = drag ? findNode(tree, drag.id) : null;

  // ── Fit to view ──
  const fitToView = useCallback(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const { width, height } = vp.getBoundingClientRect();
    const scaleX = (width - 80) / svgW;
    const scaleY = (height - 80) / svgH;
    const newZoom = Math.min(scaleX, scaleY, 1);
    setZoom(newZoom);
    setPan({
      x: (width - svgW * newZoom) / 2,
      y: (height - svgH * newZoom) / 2,
    });
  }, [svgW, svgH]);

  const handleDropAction = useCallback((action: DropAction) => {
    if (!dropMenu) return;
    const { dragId, targetId } = dropMenu;

    setTree(prev => {
      if (action === "move_under") {
        const cl = deepClone(prev);
        const [without, removed] = removeNode(cl, dragId);
        if (!removed || !without || !findNode(without, targetId)) return prev;
        return insertNode(without, targetId, removed);
      }
      if (action === "swap") {
        return swapNodes(prev, dragId, targetId);
      }
      if (action === "place_above") {
        return placeAbove(prev, dragId, targetId);
      }
      return prev;
    });

    if (onMoveNode) onMoveNode(dragId, targetId, action);
    setDropMenu(null);
  }, [dropMenu, onMoveNode]);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-card/80 backdrop-blur-xl border border-border/40 p-1 shadow-lg">
          <button
            onClick={() => applyZoom(zoom * 1.25)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            title="Zooma in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-muted-foreground w-10 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => applyZoom(zoom * 0.8)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            title="Zooma ut"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-border/60 mx-0.5" />
          <button
            onClick={fitToView}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            title="Anpassa till vy"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-card/80 backdrop-blur-xl border border-border/40 p-1 shadow-lg">
          <button
            onClick={expandAll}
            className="flex h-8 items-center gap-1 px-2 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors text-xs font-medium"
            title="Expandera alla"
          >
            <Expand className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Visa alla</span>
          </button>
          <button
            onClick={collapseAll}
            className="flex h-8 items-center gap-1 px-2 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors text-xs font-medium"
            title="Kollapsa alla"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dölj alla</span>
          </button>
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={vpRef}
        onMouseDown={onViewportMouseDown}
        className="w-full h-full overflow-hidden relative"
        style={{ cursor: drag ? "grabbing" : "grab" }}
      >
        {/* Dot grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, hsl(225, 12%, 52%) 1px, transparent 1px)",
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x % (20 * zoom)}px ${pan.y % (20 * zoom)}px`,
          }}
        />

        {/* Canvas with pan + zoom */}
        <div style={{
          position: "absolute", top: 0, left: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}>
          <svg
            width={svgW} height={svgH}
            viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
            style={{ overflow: "visible", display: "block" }}
          >
            {/* 1. Connectors */}
            <Connectors tree={tree} positions={positions} collapsed={collapsed} />

            {/* 2. Snap line */}
            {snapLine && (
              <path d={snapLine} fill="none" stroke="hsl(230, 75%, 60%)"
                strokeWidth={1.5} strokeDasharray="5 4" strokeLinecap="round" />
            )}

            {/* 3. Node cards */}
            {Array.from(positions.entries()).map(([id, pos]) => {
              const node = findNode(tree, id);
              if (!node) return null;
              return (
                <NodeCard
                  key={id}
                  node={node}
                  pos={pos}
                  isDragging={ghostIds.has(id)}
                  isDropTarget={dropTarget === id}
                  onMouseDown={(e) => onCardMouseDown(e, id)}
                />
              );
            })}

            {/* 4. Collapse buttons */}
            {Array.from(positions.entries()).map(([id, pos]) => {
              const node = findNode(tree, id);
              if (!node || !node.children.length) return null;
              return (
                <CollapseButton
                  key={`cb-${id}`}
                  pos={pos}
                  collapsed={collapsed.has(id)}
                  count={countDescendants(node)}
                  onClick={() => toggleCollapse(id)}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Drag ghost */}
      {drag && dragNode && <DragGhost node={dragNode} x={drag.curX} y={drag.curY} />}

      {/* Drop action menu */}
      {dropMenu && (
        <DropActionMenu
          menu={dropMenu}
          tree={tree}
          onAction={handleDropAction}
          onClose={() => setDropMenu(null)}
        />
      )}
    </>
  );
}
