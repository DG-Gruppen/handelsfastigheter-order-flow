/**
 * OrgChartCanvas — Interactive org chart
 *
 * Architecture:
 *  - A pure layout engine computes x/y positions for every visible node,
 *    including staff/assistant nodes (which now count toward subtree width).
 *  - Connectors are drawn as SVG paths with rounded elbows.
 *  - Cards are absolutely positioned HTML elements inside the same pan/zoom
 *    container as the SVG, which gives real text truncation (ellipsis),
 *    native tooltips and hover states instead of approximated SVG text.
 *  - Pointer events power pan + drag-and-drop (mouse and touch).
 *
 * The component is purely presentational: all data fetching and persistence
 * lives in OrgTree.tsx and is communicated via onMoveNode/onKebabClick.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ZoomIn, ZoomOut, Maximize, Minimize2, Expand, Settings, ArrowDown, ArrowUpDown, ArrowUp, ArrowRight, ArrowUpFromLine } from "lucide-react";
import { useTheme } from "next-themes";
import { ORG_COLOR_MAP } from "@/lib/orgColors";

// ─── TYPES ───────────────────────────────────────────────────────────────────
export type NodeType = "root" | "staff" | "line";
export type DropAction = "move_under" | "swap" | "place_above" | "place_beside" | "reorder_before";
export interface OrgNode {
  id: string;
  userId?: string;
  name: string;
  position: string;
  dept: string;
  deptColor?: string | null;  // hex/hsl color from department
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
interface ConnPath { d: string; dashed: boolean; }

// ─── LAYOUT CONSTANTS ────────────────────────────────────────────────────────
const CARD = {
  ROOT:  { W: 248, H: 86, R: 14 },
  LINE:  { W: 212, H: 74, R: 11 },
  EMP:   { W: 196, H: 64, R: 10 },
  STAFF: { W: 196, H: 60, R: 10 },
};

const GAP_H            = 36;   // horizontal gap between sibling subtrees
const GAP_V            = 72;   // vertical gap parent bottom → child top
const STACK_GAP        = 12;   // vertical gap between stacked leaf cards
const STACK_COL_GAP    = 28;   // gap between leaf columns
const MAX_STACK        = 6;    // max stacked leaves per column
const STAFF_TOP_GAP    = 48;   // root bottom → first staff row
const STAFF_GUTTER     = 64;   // stem → staff card inner edge
const STAFF_ROW_GAP    = 12;   // vertical gap between staff cards on one side
const STAFF_BOTTOM_GAP = 64;   // staff block → line children

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.0;

// ─── TREE UTILITIES ──────────────────────────────────────────────────────────
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

// Card size derives from node type and whether it manages anyone —
// not from the color setting, so changing colors never resizes cards.
function cardDims(node: OrgNode) {
  if (node.type === "root")  return CARD.ROOT;
  if (node.type === "staff") return CARD.STAFF;
  return node.children.length ? CARD.LINE : CARD.EMP;
}

// Staff nodes are only laid out specially directly under the root;
// anywhere else they flow as regular line children (previously they
// silently got no position at all and disappeared from the chart).
function staffKidsOf(node: OrgNode): OrgNode[] {
  return node.type === "root" ? node.children.filter(c => c.type === "staff") : [];
}
function lineKidsOf(node: OrgNode): OrgNode[] {
  return node.type === "root" ? node.children.filter(c => c.type !== "staff") : node.children;
}

function isLeafNode(node: OrgNode): boolean {
  return node.children.length === 0 && node.type !== "root";
}

function allChildrenAreLeaves(node: OrgNode): boolean {
  const kids = lineKidsOf(node);
  return kids.length > 0 && kids.every(isLeafNode);
}

// Split leaves into balanced sequential columns of at most MAX_STACK
function stackColumns(kids: OrgNode[]): OrgNode[][] {
  const cols = Math.ceil(kids.length / MAX_STACK);
  const per = Math.ceil(kids.length / cols);
  const out: OrgNode[][] = [];
  for (let i = 0; i < kids.length; i += per) out.push(kids.slice(i, i + per));
  return out;
}

// ─── LAYOUT ENGINE ───────────────────────────────────────────────────────────
function computeLayout(tree: OrgNode, collapsed: Set<string>): Map<string, Pos> {
  const pos = new Map<string, Pos>();

  function staffRegionW(node: OrgNode): number {
    return staffKidsOf(node).length ? 2 * (STAFF_GUTTER + CARD.STAFF.W) : 0;
  }

  function subtreeW(node: OrgNode): number {
    const d = cardDims(node);
    if (collapsed.has(node.id)) return d.W;
    const kids = lineKidsOf(node);
    const staffW = staffRegionW(node);
    if (!kids.length) return Math.max(d.W, staffW);
    if (allChildrenAreLeaves(node)) {
      const columns = stackColumns(kids);
      const colW = Math.max(...kids.map(k => cardDims(k).W));
      const w = columns.length * colW + (columns.length - 1) * STACK_COL_GAP;
      return Math.max(d.W, w, staffW);
    }
    const total = kids.reduce((s, c) => s + subtreeW(c), 0) + GAP_H * (kids.length - 1);
    return Math.max(d.W, total, staffW);
  }

  function place(node: OrgNode, centerX: number, top: number) {
    const d = cardDims(node);
    pos.set(node.id, { x: centerX - d.W / 2, y: top, w: d.W, h: d.H });
    if (collapsed.has(node.id)) return;

    // Staff/assistant block: two vertical columns flanking the stem
    const staff = staffKidsOf(node);
    let staffBlockH = 0;
    if (staff.length) {
      const half = Math.ceil(staff.length / 2);
      const left = staff.slice(0, half);
      const right = staff.slice(half);
      const staffTop = top + d.H + STAFF_TOP_GAP;
      const placeSide = (arr: OrgNode[], side: -1 | 1) => {
        arr.forEach((s, i) => {
          const sd = cardDims(s);
          const cx = centerX + side * (STAFF_GUTTER + sd.W / 2);
          pos.set(s.id, { x: cx - sd.W / 2, y: staffTop + i * (sd.H + STAFF_ROW_GAP), w: sd.W, h: sd.H });
        });
      };
      placeSide(left, -1);
      placeSide(right, 1);
      staffBlockH = Math.max(left.length, right.length) * (CARD.STAFF.H + STAFF_ROW_GAP) - STAFF_ROW_GAP;
    }

    const kids = lineKidsOf(node);
    if (!kids.length) return;

    const lineTop = staff.length
      ? top + d.H + STAFF_TOP_GAP + staffBlockH + STAFF_BOTTOM_GAP
      : top + d.H + GAP_V;

    // All children are leaves → stack them vertically in columns
    if (allChildrenAreLeaves(node)) {
      const columns = stackColumns(kids);
      const colW = Math.max(...kids.map(k => cardDims(k).W));
      const totalW = columns.length * colW + (columns.length - 1) * STACK_COL_GAP;
      let colCx = centerX - totalW / 2 + colW / 2;
      for (const col of columns) {
        let y = lineTop;
        for (const k of col) {
          const kd = cardDims(k);
          pos.set(k.id, { x: colCx - kd.W / 2, y, w: kd.W, h: kd.H });
          y += kd.H + STACK_GAP;
        }
        colCx += colW + STACK_COL_GAP;
      }
      return;
    }

    const totalW = kids.reduce((s, c) => s + subtreeW(c), 0) + GAP_H * (kids.length - 1);
    let childX = centerX - totalW / 2;
    for (const child of kids) {
      const sw = subtreeW(child);
      place(child, childX + sw / 2, lineTop);
      childX += sw + GAP_H;
    }
  }

  place(tree, 0, 0);
  return pos;
}

// ─── CONNECTORS ──────────────────────────────────────────────────────────────
function buildConnectors(tree: OrgNode, positions: Map<string, Pos>, collapsed: Set<string>): ConnPath[] {
  const out: ConnPath[] = [];
  const RADIUS = 12;

  // Rounded elbow: from (px,busY) horizontally toward cx, then down to topY
  function elbow(px: number, busY: number, cx: number, topY: number): string {
    const dx = cx - px;
    if (Math.abs(dx) < 1) return `M ${px} ${busY} L ${cx} ${topY}`;
    const r = Math.min(RADIUS, Math.abs(dx) / 2, Math.max(1, (topY - busY) / 2));
    const s = Math.sign(dx);
    return `M ${px} ${busY} L ${cx - s * r} ${busY} Q ${cx} ${busY} ${cx} ${busY + r} L ${cx} ${topY}`;
  }

  function draw(node: OrgNode) {
    if (collapsed.has(node.id)) return;
    const p = positions.get(node.id);
    if (!p) return;

    const px = p.x + p.w / 2;
    const py = p.y + p.h;

    // Staff: dashed horizontal from the stem to the inner edge of each card
    for (const s of staffKidsOf(node)) {
      const sp = positions.get(s.id);
      if (!sp) continue;
      const scy = sp.y + sp.h / 2;
      const onLeft = sp.x + sp.w / 2 < px;
      const innerX = onLeft ? sp.x + sp.w : sp.x;
      out.push({ d: `M ${px} ${scy} L ${innerX} ${scy}`, dashed: true });
    }

    const kidPs = lineKidsOf(node)
      .map(k => positions.get(k.id))
      .filter(Boolean) as Pos[];
    if (kidPs.length) {
      // Group children into columns by center x — stacked leaves share a
      // column, regular rows produce one column per child, so a single
      // code path handles both layouts.
      const colMap = new Map<number, Pos[]>();
      for (const kp of kidPs) {
        const cx = Math.round(kp.x + kp.w / 2);
        let key = cx;
        for (const k of colMap.keys()) {
          if (Math.abs(k - cx) < 2) { key = k; break; }
        }
        if (!colMap.has(key)) colMap.set(key, []);
        colMap.get(key)!.push(kp);
      }

      const minTop = Math.min(...kidPs.map(kp => kp.y));
      const busY = py + (minTop - py) / 2;
      out.push({ d: `M ${px} ${py} L ${px} ${busY}`, dashed: false });

      for (const [cx, col] of colMap) {
        col.sort((a, b) => a.y - b.y);
        out.push({ d: elbow(px, busY, cx, col[0].y), dashed: false });
        for (let i = 0; i < col.length - 1; i++) {
          out.push({ d: `M ${cx} ${col[i].y + col[i].h} L ${cx} ${col[i + 1].y}`, dashed: false });
        }
      }
    }

    node.children.forEach(draw);
  }

  draw(tree);
  return out;
}

function Connectors({ tree, positions, collapsed, palette }: {
  tree: OrgNode; positions: Map<string, Pos>; collapsed: Set<string>;
  palette: ReturnType<typeof useOrgPalette>;
}) {
  const paths = useMemo(
    () => buildConnectors(tree, positions, collapsed),
    [tree, positions, collapsed]
  );

  return (
    <g>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke={p.dashed ? palette.connDash : palette.connSolid}
          strokeWidth={p.dashed ? 1.4 : 1.6}
          strokeLinecap="round"
          strokeDasharray={p.dashed ? "5 4" : undefined}
          opacity={p.dashed ? 0.7 : 0.8}
        />
      ))}
    </g>
  );
}

// ─── THEME-AWARE PALETTE ─────────────────────────────────────────────────────
function useOrgPalette() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return useMemo(() => ({
    cardBg:        dark ? "hsl(230, 25%, 11%)"  : "hsl(0, 0%, 100%)",
    cardBgHover:   dark ? "hsl(230, 60%, 18%)"  : "hsl(230, 75%, 96%)",
    cardShadow:    dark ? "0 2px 10px rgba(0,0,0,0.35)" : "0 2px 8px rgba(20,30,60,0.08)",
    nameText:      dark ? "hsl(225, 12%, 93%)"  : "hsl(225, 35%, 10%)",
    posText:       dark ? "hsl(225, 12%, 58%)"  : "hsl(225, 12%, 42%)",
    deptText:      dark ? "hsl(225, 12%, 65%)"  : "hsl(225, 14%, 38%)",
    kebabDot:      dark ? "hsl(225, 12%, 52%)"  : "hsl(225, 12%, 60%)",
    connSolid:     dark ? "hsl(225, 12%, 48%)"  : "hsl(225, 15%, 70%)",
    connDash:      dark ? "hsl(250, 80%, 65%)"  : "hsl(250, 60%, 60%)",
    collapseBg:    dark ? "hsl(230, 25%, 14%)"  : "hsl(225, 25%, 97%)",
    collapseBord:  dark ? "hsl(230, 22%, 26%)"  : "hsl(225, 18%, 82%)",
    collapseText:  dark ? "hsl(225, 12%, 62%)"  : "hsl(225, 12%, 40%)",
    dotGrid:       dark ? "hsl(225, 12%, 52%)"  : "hsl(225, 15%, 72%)",
    dotOpacity:    dark ? 0.03 : 0.08,
    ghostBg:       dark ? "hsl(230, 25%, 14%)"  : "hsl(225, 25%, 97%)",
    ghostShadow:   dark ? "hsla(230, 75%, 55%, 0.3)" : "hsla(230, 75%, 55%, 0.15)",
    dropAccent:    "hsl(230, 75%, 60%)",
  }), [dark]);
}

// ─── COLOR MAP (from shared lib) ─────────────────────────────────────────────
const COLOR_MAP = ORG_COLOR_MAP;

function getColors(color: string, isDark: boolean) {
  const c = COLOR_MAP[color] || COLOR_MAP.muted;
  if (!isDark && color === "muted") {
    return {
      bg: "hsl(60, 4%, 90%)",
      border: "hsl(60, 5%, 78%)",
      text: "hsl(60, 8%, 29%)",
      accent: "hsl(60, 5%, 55%)",
    };
  }
  return {
    bg: c.bg,
    border: isDark ? c.border : c.borderLight,
    text: c.text,
    accent: c.accent,
  };
}

const TRUNCATE: React.CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// ─── COLLAPSE PILL (HTML) ────────────────────────────────────────────────────
function CollapsePill({ pos, collapsed, count, onClick, palette }: {
  pos: Pos; collapsed: boolean; count: number; onClick: () => void;
  palette: ReturnType<typeof useOrgPalette>;
}) {
  return (
    <button
      data-org-ui="true"
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={collapsed ? `Visa ${count} underställda` : "Dölj underställda"}
      style={{
        position: "absolute",
        left: pos.x + pos.w / 2,
        top: pos.y + pos.h + 5,
        transform: "translateX(-50%)",
        height: 18,
        minWidth: 26,
        padding: "0 7px",
        borderRadius: 9,
        background: palette.collapseBg,
        border: `1px solid ${palette.collapseBord}`,
        color: palette.collapseText,
        fontSize: collapsed ? 9 : 12,
        fontWeight: 600,
        lineHeight: "16px",
        cursor: "pointer",
        zIndex: 3,
        fontFamily: "var(--font-body)",
        transition: "left .25s ease, top .25s ease",
      }}
    >
      {collapsed ? `+${count}` : "−"}
    </button>
  );
}

// ─── NODE CARD (HTML) ────────────────────────────────────────────────────────
function NodeCard({ node, pos, isDragging, isDropTarget, onPointerDown, onKebabClick, palette, isDark }: {
  node: OrgNode; pos: Pos; isDragging: boolean; isDropTarget: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onKebabClick?: (e: React.MouseEvent) => void;
  palette: ReturnType<typeof useOrgPalette>;
  isDark: boolean;
}) {
  const c = getColors(node.color, isDark);
  const dims = cardDims(node);
  const isRoot = node.type === "root";

  const avatarSize = isRoot ? 34 : node.type === "staff" ? 24 : 28;
  const nameSize = isRoot ? 13.5 : 12;
  const titleSize = isRoot ? 10.5 : 9.5;
  const hasDept = !!node.dept && node.type !== "staff";
  const deptColor = node.deptColor || c.accent;

  return (
    <div
      data-org-card="true"
      title={node.position ? `${node.name} — ${node.position}` : node.name}
      onPointerDown={isRoot ? undefined : onPointerDown}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: pos.w,
        height: pos.h,
        boxSizing: "border-box",
        borderRadius: dims.R,
        background: isDropTarget ? palette.cardBgHover : palette.cardBg,
        border: `${isDropTarget ? 1.5 : 1}px solid ${isDropTarget ? palette.dropAccent : c.border}`,
        boxShadow: isDropTarget
          ? `0 0 0 4px hsla(230, 75%, 60%, 0.18), ${palette.cardShadow}`
          : palette.cardShadow,
        opacity: isDragging ? 0.25 : 1,
        display: "flex",
        alignItems: "center",
        paddingRight: onKebabClick ? 26 : 10,
        cursor: isRoot ? "default" : "grab",
        userSelect: "none",
        touchAction: "none",
        zIndex: isDropTarget ? 2 : 1,
        transition: "left .25s ease, top .25s ease, box-shadow .15s ease, border-color .15s ease, background-color .15s ease, opacity .15s ease",
      }}
    >
      {/* Accent bar */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: isRoot ? 5 : 4,
        background: c.bg,
        borderRadius: `${dims.R}px 0 0 ${dims.R}px`,
      }} />

      {/* Avatar */}
      <div style={{
        width: avatarSize, height: avatarSize,
        borderRadius: "50%",
        flexShrink: 0,
        marginLeft: 13,
        background: c.bg,
        color: c.text,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-heading)",
        fontWeight: 700,
        fontSize: avatarSize * 0.38,
        letterSpacing: 0.3,
      }}>
        {node.avatar}
      </div>

      {/* Name / title / department */}
      <div style={{ flex: 1, minWidth: 0, marginLeft: 10, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{
          ...TRUNCATE,
          fontSize: nameSize,
          fontWeight: 700,
          color: palette.nameText,
          fontFamily: "var(--font-heading)",
          lineHeight: 1.15,
        }}>
          {node.name}
        </span>
        {node.position && (
          <span style={{
            ...TRUNCATE,
            fontSize: titleSize,
            color: palette.posText,
            fontFamily: "var(--font-body)",
            lineHeight: 1.2,
          }}>
            {node.position}
          </span>
        )}
        {hasDept && (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            alignSelf: "flex-start",
            maxWidth: "100%",
            boxSizing: "border-box",
            padding: "1px 6px",
            borderRadius: 4,
            background: `color-mix(in srgb, ${deptColor} 14%, transparent)`,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: deptColor }} />
            <span style={{
              ...TRUNCATE,
              fontSize: 8.5,
              fontWeight: 500,
              color: palette.deptText,
              fontFamily: "var(--font-body)",
            }}>
              {node.dept}
            </span>
          </span>
        )}
      </div>

      {/* Kebab menu */}
      {onKebabClick && (
        <button
          data-org-ui="true"
          title="Redigera kort"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onKebabClick(e); }}
          style={{
            position: "absolute", top: 4, right: 4,
            width: 20, height: 20,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 2.5,
            background: "transparent",
            border: "none",
            borderRadius: 5,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: palette.kebabDot, display: "block" }} />
          ))}
        </button>
      )}
    </div>
  );
}

// ─── DROP ACTION MENU ────────────────────────────────────────────────────────
function DropActionMenu({ menu, tree, unassignedNodes, onAction, onClose }: {
  menu: DropMenuState;
  tree: OrgNode;
  unassignedNodes: OrgNode[];
  onAction: (action: DropAction) => void;
  onClose: () => void;
}) {
  const dragNode = findNode(tree, menu.dragId) || unassignedNodes.find(n => n.id === menu.dragId);
  const targetNode = findNode(tree, menu.targetId) || unassignedNodes.find(n => n.id === menu.targetId);
  if (!dragNode || !targetNode) return null;

  const canSwap = targetNode.type !== "root";
  const canPlaceAbove = targetNode.type !== "root" && !isAncestor(tree, menu.dragId, menu.targetId);
  const targetParent = findParent(tree, menu.targetId);
  const dragParent = findParent(tree, menu.dragId);
  const canPlaceBeside = targetNode.type !== "root" && !!targetParent;
  const areSiblings = targetParent && dragParent && targetParent.id === dragParent.id;

  const actions: { key: DropAction; label: string; desc: string; icon: React.ReactNode; enabled: boolean }[] = [
    {
      key: "move_under",
      label: "Flytta under",
      desc: `${dragNode.name} blir underställd ${targetNode.name}`,
      icon: <ArrowDown className="h-4 w-4" />,
      enabled: true,
    },
    {
      key: "reorder_before",
      label: "Flytta före",
      desc: `${dragNode.name} placeras före ${targetNode.name}`,
      icon: <ArrowUpFromLine className="h-4 w-4" />,
      enabled: !!areSiblings,
    },
    {
      key: "place_beside",
      label: "Placera bredvid",
      desc: `${dragNode.name} hamnar på samma nivå som ${targetNode.name}`,
      icon: <ArrowRight className="h-4 w-4" />,
      enabled: canPlaceBeside && !areSiblings,
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

  // Clamp so the menu never renders outside the viewport
  const MENU_W = 250;
  const MENU_H = 300;
  const left = Math.min(Math.max(menu.screenX, MENU_W / 2 + 8), window.innerWidth - MENU_W / 2 - 8);
  const top = Math.min(Math.max(menu.screenY, MENU_H / 2 + 8), window.innerHeight - MENU_H / 2 - 8);

  return (
    <div
      className="fixed inset-0 z-[10000]"
      onClick={onClose}
    >
      <div
        className="absolute z-[10001]"
        style={{ left, top, transform: "translate(-50%, -50%)" }}
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

// ─── DRAG GHOST ──────────────────────────────────────────────────────────────
function DragGhost({ node, x, y, palette, isDark }: { node: OrgNode; x: number; y: number; palette: ReturnType<typeof useOrgPalette>; isDark: boolean }) {
  if (!node) return null;
  const { W, H } = cardDims(node);
  const c = getColors(node.color, isDark);
  return (
    <div style={{
      position: "fixed", left: x, top: y, pointerEvents: "none", zIndex: 9999,
      transform: "translate(-50%, -50%) rotate(3deg) scale(1.04)",
    }}>
      <div style={{
        width: W, height: H, borderRadius: 10,
        background: palette.ghostBg,
        border: `1.5px solid ${c.bg}`,
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "0 14px", gap: 2,
        opacity: 0.92,
        boxShadow: `0 8px 32px ${palette.ghostShadow}`,
        boxSizing: "border-box",
      }}>
        <span style={{
          ...TRUNCATE,
          fontWeight: 700, color: palette.nameText, fontSize: 12,
          fontFamily: "var(--font-heading)",
        }}>{node.name}</span>
        {node.position && (
          <span style={{
            ...TRUNCATE,
            color: palette.posText, fontSize: 10,
            fontFamily: "var(--font-body)",
          }}>{node.position}</span>
        )}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
interface OrgChartCanvasProps {
  initialTree: OrgNode;
  unassignedNodes?: OrgNode[];
  onMoveNode?: (movedNodeId: string, newParentId: string, action: DropAction) => void;
  onKebabClick?: (nodeId: string, screenX: number, screenY: number) => void;
  onSettingsClick?: () => void;
}

const DRAG_THRESHOLD = 5;       // px of pointer travel before a drag starts
const UNASSIGNED_GAP = 100;     // gap between tree and the unassigned panel
const DROP_HIT_PAD = 16;        // canvas-px margin around a card that counts as a hit

export default function OrgChartCanvas({ initialTree, unassignedNodes = [], onMoveNode, onKebabClick, onSettingsClick }: OrgChartCanvasProps) {
  const palette = useOrgPalette();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [tree, setTree]             = useState(initialTree);
  const [collapsed, setCollapsed]   = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("org-collapsed");
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [drag, setDrag]             = useState<{ id: string; curX: number; curY: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dropMenu, setDropMenu]     = useState<DropMenuState | null>(null);
  const [zoom, setZoom]             = useState(1);
  const [pan, setPan]               = useState({ x: 0, y: 0 });

  const vpRef    = useRef<HTMLDivElement>(null);
  const pendRef  = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const dragRef  = useRef<{ id: string; curX: number; curY: number } | null>(null);
  const dropRef  = useRef<string | null>(null);
  const panRef   = useRef<{ panning: boolean; start: { mx: number; my: number; px: number; py: number } | null }>({ panning: false, start: null });
  const zoomRef  = useRef(zoom);  zoomRef.current = zoom;
  const panXY    = useRef(pan);   panXY.current   = pan;
  const treeRef  = useRef(tree);  treeRef.current = tree;

  useEffect(() => { setTree(initialTree); }, [initialTree]);

  // ── Layout ──
  const positions = useMemo(() => {
    const pos = computeLayout(tree, collapsed);

    // Unassigned nodes stack in a panel to the right of the tree
    if (unassignedNodes.length > 0) {
      let mxX = -Infinity;
      for (const [, p] of pos) mxX = Math.max(mxX, p.x + p.w);
      const startX = mxX + UNASSIGNED_GAP;
      let y = 0;
      for (const node of unassignedNodes) {
        const dims = cardDims(node);
        pos.set(node.id, { x: startX, y, w: dims.W, h: dims.H });
        y += dims.H + STACK_GAP;
      }
    }

    return pos;
  }, [tree, collapsed, unassignedNodes]);

  const { minX, minY, svgW, svgH } = useMemo(() => {
    let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
    for (const [, p] of positions) {
      mnX = Math.min(mnX, p.x - 50); mnY = Math.min(mnY, p.y - 50);
      mxX = Math.max(mxX, p.x + p.w + 50); mxY = Math.max(mxY, p.y + p.h + 50);
    }
    return { minX: mnX, minY: mnY, svgW: mxX - mnX, svgH: mxY - mnY };
  }, [positions]);

  const bboxRef = useRef({ svgW, svgH });
  bboxRef.current = { svgW, svgH };

  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const minXY = useRef({ minX, minY });
  minXY.current = { minX, minY };

  const ghostIds = useMemo(() => {
    if (!drag) return new Set<string>();
    const n = findNode(tree, drag.id) || unassignedNodes.find(u => u.id === drag.id);
    return n ? collectIds(n, new Set()) : new Set<string>();
  }, [drag, tree, unassignedNodes]);

  // ── Fit to view ──
  const fitToView = useCallback(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const { width, height } = vp.getBoundingClientRect();
    const { svgW: w, svgH: h } = bboxRef.current;
    const newZoom = Math.min((width - 60) / w, (height - 60) / h, 1);
    const z = Math.max(MIN_ZOOM, newZoom);
    setZoom(z);
    setPan({ x: (width - w * z) / 2, y: (height - h * z) / 2 });
  }, []);

  // Fit the whole chart on first mount (the component is no longer remounted
  // on data changes, so pan/zoom survive moves and realtime updates)
  useEffect(() => { fitToView(); }, [fitToView]);

  // ── Collapse / expand ──
  const persistCollapsed = useCallback((s: Set<string>) => {
    try { localStorage.setItem("org-collapsed", JSON.stringify([...s])); } catch { /* ignore */ }
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      persistCollapsed(s);
      return s;
    });
  }, [persistCollapsed]);

  const expandAll = useCallback(() => {
    const s = new Set<string>();
    setCollapsed(s);
    persistCollapsed(s);
  }, [persistCollapsed]);

  const collapseAll = useCallback(() => {
    const s = new Set<string>();
    const go = (n: OrgNode) => { if (n.children.length) { s.add(n.id); n.children.forEach(go); } };
    go(tree);
    setCollapsed(s);
    persistCollapsed(s);
  }, [tree, persistCollapsed]);

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

  // ── Coordinate transforms & drop targeting ──
  const screenToCanvas = useCallback((sx: number, sy: number) => {
    const vp = vpRef.current?.getBoundingClientRect();
    if (!vp) return { x: 0, y: 0 };
    return {
      x: (sx - vp.left - panXY.current.x) / zoomRef.current + minXY.current.minX,
      y: (sy - vp.top  - panXY.current.y) / zoomRef.current + minXY.current.minY,
    };
  }, []);

  // Hit-test: the pointer must actually be over (or within a small margin of)
  // a card — no more snapping to the nearest card within an arbitrary radius.
  const findDropTarget = useCallback((sx: number, sy: number, dragId: string): string | null => {
    const { x: cx, y: cy } = screenToCanvas(sx, sy);
    let best: string | null = null, bestDist = Infinity;
    for (const [id, p] of positionsRef.current) {
      if (id === dragId) continue;
      if (cx < p.x - DROP_HIT_PAD || cx > p.x + p.w + DROP_HIT_PAD) continue;
      if (cy < p.y - DROP_HIT_PAD || cy > p.y + p.h + DROP_HIT_PAD) continue;
      if (isAncestor(treeRef.current, dragId, id)) continue;
      const parent = findParent(treeRef.current, dragId);
      if (parent && parent.id === id) continue;
      const targetNode = findNode(treeRef.current, id);
      if (targetNode?.type === "staff") continue;
      const dist = Math.hypot(cx - (p.x + p.w / 2), cy - (p.y + p.h / 2));
      if (dist < bestDist) { bestDist = dist; best = id; }
    }
    return best;
  }, [screenToCanvas]);

  // ── Pan + drag (pointer events: mouse and touch) ──
  const onViewportPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-org-card]") || target.closest("[data-org-ui]")) return;
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    panRef.current = {
      panning: true,
      start: { mx: e.clientX, my: e.clientY, px: panXY.current.x, py: panXY.current.y },
    };
  }, []);

  const onCardPointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    if (e.button !== 0 || nodeId === treeRef.current.id) return;
    e.preventDefault();
    e.stopPropagation();
    pendRef.current = { id: nodeId, startX: e.clientX, startY: e.clientY };
  }, []);

  useEffect(() => {
    const cancelDrag = () => {
      pendRef.current = null;
      dragRef.current = null;
      dropRef.current = null;
      setDrag(null);
      setDropTarget(null);
    };

    const onMove = (e: PointerEvent) => {
      if (panRef.current.panning && panRef.current.start) {
        const { start } = panRef.current;
        setPan({ x: start.px + e.clientX - start.mx, y: start.py + e.clientY - start.my });
        return;
      }
      // Promote a pending press to a drag only after a small movement,
      // so plain clicks never flash a drag ghost
      if (pendRef.current && !dragRef.current) {
        const { id, startX, startY } = pendRef.current;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) >= DRAG_THRESHOLD) {
          dragRef.current = { id, curX: e.clientX, curY: e.clientY };
          setDrag({ ...dragRef.current });
        }
      }
      if (!dragRef.current) return;
      const updated = { ...dragRef.current, curX: e.clientX, curY: e.clientY };
      dragRef.current = updated;
      setDrag({ ...updated });
      const dt = findDropTarget(e.clientX, e.clientY, updated.id);
      dropRef.current = dt;
      setDropTarget(dt);
    };

    const onUp = (e: PointerEvent) => {
      if (panRef.current.panning) { panRef.current = { panning: false, start: null }; return; }
      if (!dragRef.current) { pendRef.current = null; return; }

      const { id } = dragRef.current;
      const dt = dropRef.current;
      if (dt && dt !== id) {
        setDropMenu({ dragId: id, targetId: dt, screenX: e.clientX, screenY: e.clientY });
      }
      cancelDrag();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (dragRef.current || pendRef.current)) cancelDrag();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [findDropTarget]);

  // ── Snap line ──
  const snapLine = useMemo(() => {
    if (!drag || !dropTarget) return null;
    const dragP = positions.get(drag.id);
    const targetP = positions.get(dropTarget);
    if (!targetP || !dragP) return null;
    return {
      sx: dragP.x + dragP.w / 2, sy: dragP.y + dragP.h / 2,
      tx: targetP.x + targetP.w / 2, ty: targetP.y + targetP.h / 2,
    };
  }, [drag, dropTarget, positions]);

  const dragNode = drag ? (findNode(tree, drag.id) || unassignedNodes.find(n => n.id === drag.id)) : null;

  // ── Drop actions (optimistic local update; persistence via onMoveNode) ──
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
      if (action === "place_beside") {
        const cl = deepClone(prev);
        const targetParent = findParent(cl, targetId);
        if (!targetParent) return prev;
        const [without, removed] = removeNode(cl, dragId);
        if (!removed || !without) return prev;
        return insertNode(without, targetParent.id, removed);
      }
      if (action === "reorder_before") {
        const cl = deepClone(prev);
        const parent = findParent(cl, targetId);
        if (!parent) return prev;
        const [without, removed] = removeNode(cl, dragId);
        if (!removed || !without) return prev;
        const parentInResult = findNode(without, parent.id);
        if (!parentInResult) return prev;
        const targetIdx = parentInResult.children.findIndex(c => c.id === targetId);
        if (targetIdx === -1) return prev;
        parentInResult.children.splice(targetIdx, 0, removed);
        return without;
      }
      return prev;
    });

    if (onMoveNode) onMoveNode(dragId, targetId, action);
    setDropMenu(null);
  }, [dropMenu, onMoveNode]);

  // ── Unassigned panel bounds ──
  const unassignedPanel = useMemo(() => {
    if (!unassignedNodes.length) return null;
    const ps = unassignedNodes.map(n => positions.get(n.id)).filter(Boolean) as Pos[];
    if (!ps.length) return null;
    const x0 = Math.min(...ps.map(p => p.x)) - 16;
    const y0 = Math.min(...ps.map(p => p.y)) - 36;
    const x1 = Math.max(...ps.map(p => p.x + p.w)) + 16;
    const y1 = Math.max(...ps.map(p => p.y + p.h)) + 16;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [unassignedNodes, positions]);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-card/80 backdrop-blur-xl border border-border/40 p-1 shadow-lg">
          <button
            onClick={() => applyZoom(zoom * 1.25)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            title="Zooma in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => applyZoom(1)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground w-10 text-center select-none transition-colors"
            title="Återställ zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
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

        {onSettingsClick && (
          <div className="flex items-center gap-1 rounded-xl bg-card/80 backdrop-blur-xl border border-border/40 p-1 shadow-lg">
            <button
              onClick={onSettingsClick}
              className="flex h-8 items-center gap-1 px-2 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors text-xs font-medium"
              title="Inställningar"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Inställningar</span>
            </button>
          </div>
        )}
      </div>

      {/* Viewport */}
      <div
        ref={vpRef}
        onPointerDown={onViewportPointerDown}
        className="w-full h-full overflow-hidden relative"
        style={{ cursor: drag ? "grabbing" : "grab", touchAction: "none" }}
      >
        {/* Dot grid background */}
        <div
          className="absolute inset-0"
          style={{
            opacity: palette.dotOpacity,
            backgroundImage: `radial-gradient(circle, ${palette.dotGrid} 1px, transparent 1px)`,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x % (20 * zoom)}px ${pan.y % (20 * zoom)}px`,
          }}
        />

        {/* Canvas with pan + zoom */}
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: svgW, height: svgH,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}>
          {/* Connector layer */}
          <svg
            width={svgW} height={svgH}
            viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
            style={{ position: "absolute", top: 0, left: 0, overflow: "visible", display: "block" }}
          >
            <Connectors tree={tree} positions={positions} collapsed={collapsed} palette={palette} />

            {/* Snap line + drop target pulse */}
            {snapLine && (
              <g>
                <line x1={snapLine.sx} y1={snapLine.sy} x2={snapLine.tx} y2={snapLine.ty}
                  stroke={palette.dropAccent} strokeWidth={4} strokeLinecap="round" opacity={0.25} />
                <line x1={snapLine.sx} y1={snapLine.sy} x2={snapLine.tx} y2={snapLine.ty}
                  stroke={palette.dropAccent} strokeWidth={1.5} strokeDasharray="6 5"
                  strokeLinecap="round" style={{ animation: "snap-dash 0.6s linear infinite" }} />
                <circle cx={snapLine.tx} cy={snapLine.ty} r={8}
                  fill="none" stroke={palette.dropAccent} strokeWidth={1.5} opacity={0.6}>
                  <animate attributeName="r" from="6" to="18" dur="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite" />
                </circle>
                <circle cx={snapLine.tx} cy={snapLine.ty} r={5} fill={palette.dropAccent} opacity={0.4} />
              </g>
            )}
          </svg>

          {/* Unassigned panel frame */}
          {unassignedPanel && (
            <div style={{
              position: "absolute",
              left: unassignedPanel.x - minX,
              top: unassignedPanel.y - minY,
              width: unassignedPanel.w,
              height: unassignedPanel.h,
              border: `1.5px dashed ${palette.collapseBord}`,
              borderRadius: 14,
            }}>
              <span style={{
                position: "absolute", top: 8, left: 14,
                fontSize: 10.5, fontWeight: 600,
                color: palette.posText,
                fontFamily: "var(--font-heading)",
              }}>
                Ej placerade
              </span>
            </div>
          )}

          {/* Card layer (HTML for real text truncation and tooltips) */}
          {Array.from(positions.entries()).map(([id, pos]) => {
            const node = findNode(tree, id) || unassignedNodes.find(n => n.id === id);
            if (!node) return null;
            return (
              <NodeCard
                key={id}
                node={node}
                pos={{ ...pos, x: pos.x - minX, y: pos.y - minY }}
                isDragging={ghostIds.has(id)}
                isDropTarget={dropTarget === id}
                onPointerDown={(e) => onCardPointerDown(e, id)}
                onKebabClick={onKebabClick ? (e) => {
                  onKebabClick(id, e.clientX, e.clientY);
                } : undefined}
                palette={palette}
                isDark={isDark}
              />
            );
          })}

          {/* Collapse pills */}
          {Array.from(positions.entries()).map(([id, pos]) => {
            const node = findNode(tree, id);
            if (!node || !node.children.length) return null;
            return (
              <CollapsePill
                key={`cb-${id}`}
                pos={{ ...pos, x: pos.x - minX, y: pos.y - minY }}
                collapsed={collapsed.has(id)}
                count={countDescendants(node)}
                onClick={() => toggleCollapse(id)}
                palette={palette}
              />
            );
          })}
        </div>
      </div>

      {/* Drag ghost */}
      {drag && dragNode && <DragGhost node={dragNode} x={drag.curX} y={drag.curY} palette={palette} isDark={isDark} />}

      {/* Drop action menu */}
      {dropMenu && (
        <DropActionMenu
          menu={dropMenu}
          tree={tree}
          unassignedNodes={unassignedNodes}
          onAction={handleDropAction}
          onClose={() => setDropMenu(null)}
        />
      )}
    </>
  );
}
