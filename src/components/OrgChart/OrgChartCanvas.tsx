import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ─── Types ──────────────────────────────────────────────────
export type ColorKey = "cyan" | "blue" | "emerald" | "amber" | "slate" | "violet";
export type NodeType = "root" | "staff" | "line";

export interface OrgNode {
  id: string;
  userId: string;
  name: string;
  position: string;
  dept: string;
  avatar: string;
  color: ColorKey;
  type: NodeType;
  children: OrgNode[];
}

interface DragState { id: string; curX: number; curY: number; }
interface Pos { x: number; y: number; w: number; h: number; }

// ─── Card dimensions ────────────────────────────────────────
const RC = { W: 228, H: 74, R: 14 };
const SC = { W: 182, H: 60, R: 10 };
const LC = { W: 192, H: 66, R: 11 };
const EC = { W: 168, H: 58, R: 9 };

const GAP_H = 28;
const GAP_V = 110;
const STAFF_GAP_V = 130;
const LINE_AFTER_STAFF = 130;

// ─── Color palette (matching original Claude artifact) ──────
interface ColorSet { a: string; b: string; t: string; g: string; r: string; n: string; }

const C: Record<ColorKey, ColorSet> = {
  cyan:    { a:"#22d3ee", b:"#0d3d4a", t:"#67e8f9", g:"rgba(34,211,238,0.18)",  r:"rgba(34,211,238,0.45)", n:"#8dd8e8" },
  blue:    { a:"#60a5fa", b:"#122040", t:"#93c5fd", g:"rgba(96,165,250,0.16)",  r:"rgba(96,165,250,0.42)",  n:"#9dbff7" },
  emerald: { a:"#34d399", b:"#053325", t:"#6ee7b7", g:"rgba(52,211,153,0.16)",  r:"rgba(52,211,153,0.42)",  n:"#7ddcb5" },
  amber:   { a:"#fbbf24", b:"#3b1e02", t:"#fcd34d", g:"rgba(251,191,36,0.16)",  r:"rgba(251,191,36,0.42)",  n:"#f5d070" },
  slate:   { a:"#8899b0", b:"#101a28", t:"#8899b0", g:"rgba(136,153,176,0.10)", r:"rgba(136,153,176,0.28)", n:"#5d718a" },
  violet:  { a:"#a78bfa", b:"#1e0c40", t:"#c4b5fd", g:"rgba(167,139,250,0.16)", r:"rgba(167,139,250,0.42)", n:"#baa7f8" },
};

// ─── Tree utilities ─────────────────────────────────────────
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
  for (const c of tree.children) { const [nc, r] = removeNode(c, id); if (r) rem = r; if (nc) ch.push(nc); }
  return [{ ...tree, children: ch }, rem];
}
function insertNode(tree: OrgNode, targetId: string, node: OrgNode): OrgNode {
  if (tree.id === targetId) return { ...tree, children: [...tree.children, node] };
  return { ...tree, children: tree.children.map(c => insertNode(c, targetId, node)) };
}
function isAncestor(tree: OrgNode, ancId: string, nodeId: string): boolean {
  const n = findNode(tree, ancId); return n ? !!findNode(n, nodeId) : false;
}
function collectIds(node: OrgNode, set = new Set<string>()): Set<string> {
  set.add(node.id); node.children.forEach(c => collectIds(c, set)); return set;
}
function countDesc(node: OrgNode): number {
  let n = 0; const go = (nd: OrgNode) => { n += nd.children.length; nd.children.forEach(go); }; go(node); return n;
}
function cardDims(node: OrgNode) {
  if (node.type === "root") return RC;
  if (node.type === "staff") return SC;
  if (node.color === "slate") return EC;
  return LC;
}

// ─── Layout engine ──────────────────────────────────────────
function computeLayout(tree: OrgNode, collapsed: Set<string>): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  function subtreeW(node: OrgNode): number {
    if (collapsed.has(node.id)) return cardDims(node).W;
    const kids = node.children.filter(c => c.type !== "staff");
    if (!kids.length) return cardDims(node).W;
    const total = kids.reduce((s, c) => s + subtreeW(c), 0) + GAP_H * (kids.length - 1);
    return Math.max(cardDims(node).W, total);
  }
  function place(node: OrgNode, cx: number, top: number) {
    const { W, H } = cardDims(node);
    pos.set(node.id, { x: cx - W / 2, y: top, w: W, h: H });
    if (collapsed.has(node.id)) return;
    const staffKids = node.children.filter(c => c.type === "staff");
    const lineKids = node.children.filter(c => c.type !== "staff");
    if (staffKids.length && node.type === "root") {
      const sw = SC.W;
      const rowW = staffKids.length * sw + (staffKids.length - 1) * GAP_H;
      let sx = cx - rowW / 2;
      const sTop = top + H + STAFF_GAP_V;
      staffKids.forEach(s => { pos.set(s.id, { x: sx, y: sTop, w: sw, h: SC.H }); sx += sw + GAP_H; });
    }
    if (!lineKids.length) return;
    let lineTop: number;
    if (node.type === "root" && staffKids.length) {
      lineTop = top + H + STAFF_GAP_V + SC.H + LINE_AFTER_STAFF;
    } else {
      lineTop = top + H + GAP_V;
    }
    const totalW = lineKids.reduce((s, c) => s + subtreeW(c), 0) + GAP_H * (lineKids.length - 1);
    let childX = cx - totalW / 2;
    lineKids.forEach(child => { const sw = subtreeW(child); place(child, childX + sw / 2, lineTop); childX += sw + GAP_H; });
  }
  place(tree, 0, 0);
  return pos;
}

// ─── SVG gradient & filter definitions ──────────────────────
function GradDefs() {
  return (
    <defs>
      {Object.entries(C).map(([k, col]) => (
        <linearGradient key={k} id={`bg-${k}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={col.a} stopOpacity={0.10} />
          <stop offset="100%" stopColor={col.b} stopOpacity={0.96} />
        </linearGradient>
      ))}
      {Object.entries(C).map(([k, col]) => (
        <linearGradient key={`tg-${k}`} id={`tg-${k}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={col.a} stopOpacity={0} />
          <stop offset="50%" stopColor={col.a} stopOpacity={1} />
          <stop offset="100%" stopColor={col.a} stopOpacity={0} />
        </linearGradient>
      ))}
      {Object.entries(C).map(([k, col]) => (
        <filter key={`gf-${k}`} id={`gf-${k}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feFlood floodColor={col.a} floodOpacity={0.35} result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      ))}
      <filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="rgba(0,0,0,0.55)" /></filter>
      <filter id="shadowHov"><feDropShadow dx="0" dy="5" stdDeviation="10" floodColor="rgba(0,0,0,0.7)" /></filter>
    </defs>
  );
}

// ─── SVG Card ───────────────────────────────────────────────
function SvgCard({ node, pos, dragging, isDrop, onMD }: {
  node: OrgNode; pos: Pos; dragging: boolean; isDrop: boolean;
  onMD?: (e: React.MouseEvent) => void;
}) {
  const col = C[node.color];
  const { x, y, w, h } = pos;
  const R = cardDims(node).R;
  const isRoot = node.type === "root";
  const isStaff = node.type === "staff";
  const avX = x + (isRoot ? 26 : 22);
  const avR = isRoot ? 18 : isStaff ? 13 : 14;
  const textX = avX + avR + 9;
  const [hov, setHov] = useState(false);

  const filter = isDrop || isRoot ? `url(#gf-${node.color})` : hov ? "url(#shadowHov)" : "url(#shadow)";
  const stroke = isDrop ? col.a : isRoot ? col.r : hov ? "rgba(255,255,255,0.22)" : isStaff ? "none" : "rgba(255,255,255,0.07)";

  return (
    <g style={{ cursor: isRoot ? "default" : "grab", opacity: dragging ? 0.15 : 1, transition: "opacity 0.2s" }}
      onMouseDown={isRoot ? undefined : onMD}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {(hov || isDrop) && !isRoot && (
        <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={R + 4} fill="none" stroke={col.a}
          strokeWidth={1.5} opacity={isDrop ? 0.7 : 0.3} style={{ filter: `drop-shadow(0 0 8px ${col.a})` }} />
      )}
      <rect x={x} y={y} width={w} height={h} rx={R} fill={`url(#bg-${node.color})`}
        stroke={stroke} strokeWidth={1.5} filter={filter} />
      {isStaff && !isDrop && (
        <rect x={x} y={y} width={w} height={h} rx={R} fill="none" stroke={col.r}
          strokeWidth={1.5} strokeDasharray="6 4" opacity={hov ? 0.75 : 0.4} />
      )}
      <rect x={x + w * 0.18} y={y + 0.5} width={w * 0.64} height={isRoot ? 2.5 : 1.5} rx={1.5}
        fill={`url(#tg-${node.color})`} opacity={isRoot ? 1 : hov || isDrop ? 0.75 : 0.28} />
      {/* Avatar circle */}
      <circle cx={avX} cy={y + h / 2} r={avR} fill={col.b} stroke={col.r} strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 0 ${hov || isDrop ? 6 : 3}px ${col.a}${hov || isDrop ? "88" : "44"})` }} />
      <text x={avX} y={y + h / 2} textAnchor="middle" dominantBaseline="central"
        fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize={isRoot ? 10.5 : isStaff ? 8.5 : 9} fill={col.a}>
        {node.avatar.slice(0, 2)}
      </text>
      {/* Position / title */}
      <text x={textX} y={y + h / 2 - (isStaff ? 7.5 : 9)} fontFamily="'Space Grotesk',sans-serif" fontWeight="700"
        fontSize={isRoot ? 13 : isStaff ? 11 : 11.5} fill={isStaff ? "#c0b0fe" : "#dde4f0"}>
        {node.position.length > 22 ? node.position.slice(0, 21) + "…" : node.position}
      </text>
      {/* Name */}
      <text x={textX} y={y + h / 2 + (isStaff ? 6 : 7)} fontFamily="'DM Sans',sans-serif" fontWeight="400"
        fontSize={isRoot ? 10 : 9.5} fill={col.n} opacity={0.65}>
        {node.name.length > 23 ? node.name.slice(0, 22) + "…" : node.name}
      </text>
      {/* Department badge (not for employees) */}
      {node.color !== "slate" && node.dept && (
        <g opacity={isStaff ? 0.7 : 0.9}>
          <rect x={x + w - (isRoot ? 46 : 40)} y={y + h / 2 - 9} width={isRoot ? 38 : 33} height={18} rx={9}
            fill={col.b} stroke={col.r} strokeWidth={1} strokeOpacity={0.55} />
          <text x={x + w - (isRoot ? 27 : 23.5)} y={y + h / 2 + 1} textAnchor="middle" dominantBaseline="central"
            fontFamily="'DM Sans',sans-serif" fontWeight="700" fontSize={7} fill={col.t} letterSpacing="0.08em">
            {(node.dept).toUpperCase().slice(0, 7)}
          </text>
        </g>
      )}
      {/* Staff badge */}
      {isStaff && (
        <g>
          <rect x={x + w / 2 - 14} y={y - 10} width={28} height={13} rx={4}
            fill="#14082a" stroke={col.r} strokeWidth={1} strokeOpacity={0.55} />
          <text x={x + w / 2} y={y - 3.5} textAnchor="middle" dominantBaseline="central"
            fontFamily="'DM Sans',sans-serif" fontWeight="700" fontSize={6.5} fill={col.a} letterSpacing="0.14em">
            STAB
          </text>
        </g>
      )}
    </g>
  );
}

// ─── Collapse button ────────────────────────────────────────
function CollapseBtn({ pos, collapsed, count, color, onClick }: {
  pos: Pos; collapsed: boolean; count: number; color: ColorKey; onClick: () => void;
}) {
  const col = C[color];
  const bx = pos.x + pos.w / 2, by = pos.y + pos.h + 11;
  const bw = collapsed ? Math.max(32, String(count).length * 8 + 22) : 22;
  const bh = 16;
  const [hov, setHov] = useState(false);
  return (
    <g style={{ cursor: "pointer" }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={e => { e.stopPropagation(); onClick(); }}>
      <rect x={bx - bw / 2} y={by - bh / 2} width={bw} height={bh} rx={bh / 2}
        fill={collapsed ? col.b : hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)"}
        stroke={collapsed ? col.r : hov ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}
        strokeWidth={1} style={{ filter: collapsed ? `drop-shadow(0 0 7px ${col.g})` : "none", transition: "all 0.14s" }} />
      <text x={bx} y={by + 0.5} textAnchor="middle" dominantBaseline="central"
        fontFamily="'DM Sans',sans-serif" fontWeight="600" fontSize={collapsed ? 8 : 11}
        fill={collapsed ? col.a : hov ? "#6a7f9a" : "#2e4060"}>
        {collapsed ? `+${count}` : "−"}
      </text>
    </g>
  );
}

// ─── Connector lines ────────────────────────────────────────
interface Segment { type: string; x1: number; y1: number; x2: number; y2: number; }

function Connectors({ tree, positions, collapsed }: {
  tree: OrgNode; positions: Map<string, Pos>; collapsed: Set<string>;
}) {
  const segs = useMemo(() => {
    const out: Segment[] = [];
    const push = (type: string, x1: number, y1: number, x2: number, y2: number) =>
      out.push({ type, x1, y1, x2, y2 });
    function draw(node: OrgNode) {
      if (collapsed.has(node.id)) return;
      const p = positions.get(node.id); if (!p) return;
      const px = p.x + p.w / 2, py = p.y + p.h;
      const staffC = node.children.filter(c => c.type === "staff");
      const line = node.children.filter(c => c.type !== "staff");
      if (node.type === "root" && staffC.length) {
        const sPs = staffC.map(s => positions.get(s.id)).filter(Boolean) as Pos[];
        if (sPs.length) {
          const sTopY = sPs[0].y, barY = py + (sTopY - py) / 2;
          const sXs = sPs.map(sp => sp.x + sp.w / 2);
          const minX = Math.min(px, ...sXs), maxX = Math.max(px, ...sXs);
          push("vs", px, py, px, barY);
          push("sh", minX, barY, maxX, barY);
          sPs.forEach(sp => { const scx = sp.x + sp.w / 2; push("sd", scx, barY, scx, sp.y); });
          if (line.length) {
            const lPs = line.map(l => positions.get(l.id)).filter(Boolean) as Pos[];
            if (lPs.length) {
              const lTopY = lPs[0].y, lBarY = barY + (lTopY - barY) / 2;
              const lXs = lPs.map(lp => lp.x + lp.w / 2);
              const lMin = Math.min(...lXs), lMax = Math.max(...lXs);
              push("vs", px, barY, px, lBarY);
              if (line.length > 1) push("lh", lMin, lBarY, lMax, lBarY);
              lPs.forEach(lp => { const lcx = lp.x + lp.w / 2; push("ld", lcx, lBarY, lcx, lp.y); });
            }
          }
        }
      } else if (line.length) {
        const lPs = line.map(l => positions.get(l.id)).filter(Boolean) as Pos[];
        if (lPs.length) {
          const lTopY = lPs[0].y, barY = py + (lTopY - py) / 2;
          const lXs = lPs.map(lp => lp.x + lp.w / 2);
          const lMin = Math.min(...lXs), lMax = Math.max(...lXs);
          push("vs", px, py, px, barY);
          if (line.length > 1) push("lh", lMin, barY, lMax, barY);
          lPs.forEach(lp => { const lcx = lp.x + lp.w / 2; push("ld", lcx, barY, lcx, lp.y); });
        }
      }
      line.forEach(c => draw(c));
    }
    draw(tree);
    return out;
  }, [tree, positions, collapsed]);
  return (
    <g>
      {segs.map((s, i) => {
        if (s.type === "sh" || s.type === "sd") return (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
      stroke="rgba(167,139,250,0.45)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="5 4" />
        );
        return (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} strokeLinecap="round" />
        );
      })}
      {segs.filter(s => s.type === "ld").map((s, i) => (
        <circle key={`jd-${i}`} cx={s.x1} cy={s.y1} r={2.5} fill="rgba(255,255,255,0.2)" />
      ))}
      {segs.filter(s => s.type === "sd").map((s, i) => (
        <circle key={`js-${i}`} cx={s.x1} cy={s.y1} r={2.5} fill="rgba(167,139,250,0.4)" />
      ))}
    </g>
  );
}

// ─── Drag ghost ─────────────────────────────────────────────
function DragGhost({ node, x, y }: { node: OrgNode; x: number; y: number }) {
  const col = C[node.color];
  const { W: w, H: h, R: r } = cardDims(node);
  return (
    <div style={{
      position: "fixed", left: x, top: y, pointerEvents: "none", zIndex: 9999,
      transform: "translate(-50%,-50%) rotate(4deg) scale(1.08)",
      filter: `drop-shadow(0 16px 32px rgba(0,0,0,0.8)) drop-shadow(0 0 18px ${col.a}33)`,
    }}>
      <svg width={w + 16} height={h + 16} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="ghost-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={col.a} stopOpacity={0.14} />
            <stop offset="100%" stopColor={col.b} stopOpacity={0.97} />
          </linearGradient>
        </defs>
        <rect x={8} y={8} width={w} height={h} rx={r} fill="url(#ghost-bg)" stroke={col.a}
          strokeWidth={1.5} strokeDasharray={node.type === "staff" ? "6 4" : "none"} opacity={0.95} />
        <circle cx={8 + 22} cy={8 + h / 2} r={14} fill={col.b} stroke={col.r} strokeWidth={1.5} />
        <text x={8 + 22} y={8 + h / 2} textAnchor="middle" dominantBaseline="central"
          fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize={9} fill={col.a}>
          {node.avatar.slice(0, 2)}
        </text>
        <text x={8 + 44} y={8 + h / 2 - 8} fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize={11}
          fill={node.type === "staff" ? "#c0b0fe" : "#dde4f0"}>{node.position.slice(0, 18)}</text>
        <text x={8 + 44} y={8 + h / 2 + 7} fontFamily="'DM Sans',sans-serif" fontSize={9.5} fill={col.n} opacity={0.6}>
          {node.name.slice(0, 20)}
        </text>
      </svg>
    </div>
  );
}

// ─── Toolbar ────────────────────────────────────────────────
function Toolbar({ onExpAll, onCollAll, total }: {
  onExpAll: () => void; onCollAll: () => void; total: number;
}) {
  const Btn = ({ label, fn }: { label: string; fn: () => void }) => {
    const [h, setH] = useState(false);
    return (
      <button onClick={fn} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{
          background: h ? "rgba(255,255,255,0.07)" : "transparent",
          border: `1px solid ${h ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: 8, padding: "4px 13px", cursor: "pointer",
          color: h ? "#8da0b8" : "#2e4060",
          fontSize: 11, fontFamily: "'DM Sans',sans-serif", fontWeight: 500,
          transition: "all 0.14s", outline: "none",
        }}>
        {label}
      </button>
    );
  };
  const legs: { c: ColorKey; l: string; d: boolean }[] = [
    { c: "cyan", l: "Ledning", d: false },
    { c: "violet", l: "Stab", d: true },
    { c: "blue", l: "Linjechef", d: false },
    { c: "slate", l: "Anställd", d: false },
  ];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "rgba(4,9,20,0.92)", backdropFilter: "blur(14px)",
      border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
      padding: "6px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
    }}>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, color: "#162030", fontWeight: 600 }}>
        {total} noder
      </span>
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.06)" }} />
      <Btn label="Expandera alla" fn={onExpAll} />
      <Btn label="Kollapsa alla" fn={onCollAll} />
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.06)" }} />
      {legs.map(({ c, l, d }) => (
        <div key={c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: d ? "transparent" : C[c].a,
            border: d ? `1.5px dashed ${C[c].a}` : "none",
            boxShadow: d ? "none" : `0 0 5px ${C[c].a}77`,
          }} />
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#4a6080", fontWeight: 500 }}>{l}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Zoom controls ──────────────────────────────────────────
function ZoomControls({ zoom, onIn, onOut, onReset, onFit }: {
  zoom: number; onIn: () => void; onOut: () => void; onReset: () => void; onFit: () => void;
}) {
  const BtnZ = ({ ch, fn, title, off }: { ch: string; fn: () => void; title: string; off?: boolean }) => {
    const [h, setH] = useState(false);
    return (
      <button onClick={fn} title={title} disabled={off}
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{
          background: h && !off ? "rgba(59,108,245,0.10)" : "transparent",
          border: "none", borderRadius: 8, width: 32, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: off ? "default" : "pointer",
          color: off ? "#152030" : h ? "#6d94f8" : "#3a5070",
          fontSize: 15, outline: "none", transition: "all 0.13s",
        }}>
        {ch}
      </button>
    );
  };
  return (
    <div style={{
      position: "absolute", bottom: 20, right: 20, zIndex: 300,
      display: "flex", flexDirection: "column", gap: 1, alignItems: "center",
      background: "rgba(8,14,26,0.94)", backdropFilter: "blur(14px)",
      border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 5,
      boxShadow: "0 8px 30px rgba(0,0,0,0.65)",
    }}>
      <BtnZ ch="＋" fn={onIn} title="Zooma in" off={zoom >= 2.0} />
      <div style={{
        fontFamily: "'DM Sans',sans-serif", fontSize: 9, color: "#3a5070", fontWeight: 600,
        letterSpacing: "0.06em", padding: "2px 0", textAlign: "center",
      }}>{Math.round(zoom * 100)}%</div>
      <BtnZ ch="－" fn={onOut} title="Zooma ut" off={zoom <= 0.2} />
      <div style={{ width: 18, height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />
      <BtnZ ch="⊙" fn={onFit} title="Anpassa till skärm" />
      <BtnZ ch="↺" fn={onReset} title="Återställ" />
    </div>
  );
}

// ─── Main canvas ────────────────────────────────────────────
interface OrgChartCanvasProps {
  initialTree: OrgNode;
  onMoveNode: (movedNodeId: string, newParentId: string) => void;
}

export default function OrgChartCanvas({ initialTree, onMoveNode }: OrgChartCanvasProps) {
  const [tree, setTree] = useState(initialTree);
  const [coll, setColl] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [drop, setDrop] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const vpRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const dropRef = useRef<string | null>(null);
  const panRef = useRef({ panning: false, start: { mx: 0, my: 0, px: 0, py: 0 } });
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const panXY = useRef(pan); panXY.current = pan;
  const treeRef = useRef(tree); treeRef.current = tree;

  useEffect(() => { setTree(initialTree); }, [initialTree]);

  const positions = useMemo(() => computeLayout(tree, coll), [tree, coll]);

  const { minX, minY, svgW, svgH } = useMemo(() => {
    let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
    for (const [, p] of positions) {
      mnX = Math.min(mnX, p.x - 28); mnY = Math.min(mnY, p.y - 32);
      mxX = Math.max(mxX, p.x + p.w + 28); mxY = Math.max(mxY, p.y + p.h + 32);
    }
    if (!isFinite(mnX)) return { minX: 0, minY: 0, svgW: 400, svgH: 300 };
    return { minX: mnX, minY: mnY, svgW: mxX - mnX, svgH: mxY - mnY };
  }, [positions]);

  const collDescs = useMemo(() => {
    const s = new Set<string>();
    for (const id of coll) { const n = findNode(tree, id); if (n) n.children.forEach(c => collectIds(c, s)); }
    return s;
  }, [coll, tree]);

  const ghostIds = useMemo(() => {
    if (!drag) return new Set<string>();
    const n = findNode(tree, drag.id); return n ? collectIds(n) : new Set<string>();
  }, [drag, tree]);

  const total = useMemo(() => {
    let n = 0; const go = (nd: OrgNode) => { n++; nd.children.forEach(go); }; go(tree); return n;
  }, [tree]);

  function centerLayout() {
    if (!vpRef.current) return;
    const vp = vpRef.current.getBoundingClientRect();
    setPan({ x: (vp.width - svgW) / 2, y: 60 });
  }
  useEffect(() => { setTimeout(centerLayout, 50); }, []);

  const toggle = useCallback((id: string) => {
    setColl(p => {
      const s = new Set(p);
      if (s.has(id)) { s.delete(id); } else { s.add(id); }
      return s;
    });
  }, []);
  const expandAll = useCallback(() => setColl(new Set()), []);
  const collapseAll = useCallback(() => {
    const s = new Set<string>();
    const go = (n: OrgNode) => { if (n.children.length) { s.add(n.id); n.children.forEach(go); } };
    go(tree); setColl(s);
  }, [tree]);

  const applyZoom = useCallback((nz: number, fx?: number, fy?: number) => {
    const vp = vpRef.current?.getBoundingClientRect();
    const ox = fx ?? (vp ? vp.width / 2 : 0);
    const oy = fy ?? (vp ? vp.height / 2 : 0);
    const z = Math.min(2.0, Math.max(0.2, nz));
    setPan(p => ({ x: ox - (ox - p.x) * (z / zoomRef.current), y: oy - (oy - p.y) * (z / zoomRef.current) }));
    setZoom(z);
  }, []);

  const onZoomIn = () => applyZoom(zoomRef.current + 0.12);
  const onZoomOut = () => applyZoom(zoomRef.current - 0.12);
  const onReset = () => { setZoom(1); centerLayout(); };
  const onFit = () => {
    if (!vpRef.current) return;
    const vp = vpRef.current.getBoundingClientRect();
    const z = Math.min(2.0, Math.max(0.2, Math.min((vp.width - 80) / svgW, (vp.height - 80) / svgH)));
    setPan({ x: (vp.width - svgW * z) / 2, y: (vp.height - svgH * z) / 2 }); setZoom(z);
  };

  useEffect(() => {
    const el = vpRef.current; if (!el) return;
    const fn = (e: WheelEvent) => {
      if (dragRef.current) return; e.preventDefault();
      const vr = el.getBoundingClientRect();
      applyZoom(zoomRef.current * (1 - e.deltaY * 0.001), e.clientX - vr.left, e.clientY - vr.top);
    };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, [applyZoom]);

  const onVpDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.target === vpRef.current)) {
      e.preventDefault();
      panRef.current = { panning: true, start: { mx: e.clientX, my: e.clientY, px: panXY.current.x, py: panXY.current.y } };
    }
  }, []);

  const screenToSvg = useCallback((sx: number, sy: number) => {
    const vp = vpRef.current?.getBoundingClientRect();
    if (!vp) return { x: 0, y: 0 };
    return {
      x: (sx - vp.left - panXY.current.x) / zoomRef.current + minX,
      y: (sy - vp.top - panXY.current.y) / zoomRef.current + minY,
    };
  }, [minX, minY]);

  const findDropTarget = useCallback((sx: number, sy: number, dragId: string) => {
    const { x: cx, y: cy } = screenToSvg(sx, sy);
    let best: string | null = null, bd = Infinity;
    for (const [id, pos] of positions) {
      if (id === dragId || isAncestor(treeRef.current, dragId, id)) continue;
      if (collDescs.has(id)) continue;
      const par = findParent(treeRef.current, dragId);
      if (par && par.id === id) continue;
      const ncx = pos.x + pos.w / 2, ncy = pos.y + pos.h / 2;
      const d = Math.hypot(cx - ncx, cy - ncy);
      if (d < bd) { bd = d; best = id; }
    }
    return bd < 140 ? best : null;
  }, [positions, collDescs, screenToSvg]);

  const onCardDown = useCallback((e: React.MouseEvent, id: string) => {
    if (e.button !== 0 || id === treeRef.current.id) return;
    e.preventDefault(); e.stopPropagation();
    const s: DragState = { id, curX: e.clientX, curY: e.clientY };
    dragRef.current = s; setDrag(s);
  }, []);

  useEffect(() => {
    const handleMove = (e: globalThis.MouseEvent) => {
      if (panRef.current.panning) {
        const { start } = panRef.current;
        setPan({ x: start.px + e.clientX - start.mx, y: start.py + e.clientY - start.my }); return;
      }
      if (!dragRef.current) return;
      const u: DragState = { ...dragRef.current, curX: e.clientX, curY: e.clientY };
      dragRef.current = u; setDrag({ ...u });
      const dt = findDropTarget(e.clientX, e.clientY, u.id);
      dropRef.current = dt; setDrop(dt);
    };
    const handleUp = () => {
      if (panRef.current.panning) { panRef.current = { panning: false, start: { mx: 0, my: 0, px: 0, py: 0 } }; return; }
      if (!dragRef.current) return;
      const { id } = dragRef.current;
      const dt = dropRef.current;
      if (dt && dt !== id) {
        setTree(prev => {
          const cl = deepClone(prev);
          const [wo, rem] = removeNode(cl, id);
          if (!rem || !wo || !findNode(wo, dt)) return prev;
          return insertNode(wo, dt, rem);
        });
        onMoveNode(id, dt);
      }
      dragRef.current = null; dropRef.current = null; setDrag(null); setDrop(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [findDropTarget, onMoveNode]);

  const snapLine = useMemo(() => {
    if (!drag || !drop) return null;
    const p = positions.get(drop); if (!p) return null;
    const { x: sx, y: sy } = screenToSvg(drag.curX, drag.curY);
    const tx = p.x + p.w / 2, ty = p.y + p.h, midY = ty + (sy - ty) / 2;
    const dropNode = findNode(tree, drop);
    return { d: `M${tx},${ty}L${tx},${midY}L${sx},${midY}L${sx},${sy}`, accent: C[dropNode?.color ?? "primary"].a };
  }, [drag, drop, positions, screenToSvg, tree]);

  const dragNode = drag ? findNode(tree, drag.id) : null;

  // Canvas uses sidebar-derived dark background (hsl(230,30%,12%) base)
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative",
      background: "#0c1220",
      backgroundImage: `radial-gradient(ellipse 90% 55% at 50% -8%,rgba(59,108,245,0.08) 0%,transparent 62%),
        radial-gradient(ellipse 55% 45% at 92% 92%,rgba(124,93,250,0.05) 0%,transparent 55%),
        radial-gradient(ellipse 40% 35% at 8% 80%,rgba(48,168,130,0.03) 0%,transparent 50%)`,
      fontFamily: "'DM Sans',sans-serif", overflow: "hidden", borderRadius: 12,
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 22px", borderBottom: "1px solid rgba(255,255,255,0.045)",
        background: "rgba(8,14,26,0.94)", backdropFilter: "blur(14px)", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: C.primary.a,
            boxShadow: `0 0 12px ${C.primary.a}88,0 0 24px ${C.primary.a}33`,
          }} />
          <span style={{
            fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 14.5,
            color: "#c5d8ea", letterSpacing: "-0.01em",
          }}>Organisation</span>
        </div>
        <Toolbar onExpAll={expandAll} onCollAll={collapseAll} total={total} />
      </div>

      {/* Viewport */}
      <div ref={vpRef} onMouseDown={onVpDown}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: drag ? "grabbing" : "grab" }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: "radial-gradient(circle, rgba(59,108,245,0.04) 1px, transparent 1px)",
          backgroundSize: `${26 * zoom}px ${26 * zoom}px`,
          backgroundPosition: `${pan.x % (26 * zoom)}px ${pan.y % (26 * zoom)}px`,
        }} />
        <div style={{
          position: "absolute", top: 0, left: 0,
          transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0", willChange: "transform",
        }}>
          <svg ref={svgRef} width={svgW} height={svgH} viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
            style={{ overflow: "visible", display: "block", animation: "fadeIn 0.4s ease" }}>
            <GradDefs />
            <Connectors tree={tree} positions={positions} collapsed={coll} />
            {snapLine && (
              <g>
                <path d={snapLine.d} fill="none" stroke={`${snapLine.accent}28`} strokeWidth={8} strokeLinecap="round" />
                <path d={snapLine.d} fill="none" stroke={snapLine.accent} strokeWidth={1.5}
                  strokeLinecap="round" strokeDasharray="5 4" style={{ animation: "dashAnim 0.3s linear infinite" }} />
                {(() => {
                  const dp = positions.get(drop!);
                  if (!dp) return null;
                  return (
                    <circle cx={dp.x + dp.w / 2} cy={dp.y + dp.h} r={3.5} fill={snapLine.accent}>
                      <animate attributeName="r" values="3;8;3" dur="1s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1s" repeatCount="indefinite" />
                    </circle>
                  );
                })()}
              </g>
            )}
            {Array.from(positions.entries()).map(([id, pos]) => {
              const node = findNode(tree, id); if (!node) return null;
              return <SvgCard key={id} node={node} pos={pos} dragging={ghostIds.has(id)} isDrop={drop === id} onMD={(e) => onCardDown(e, id)} />;
            })}
            {Array.from(positions.entries()).map(([id, pos]) => {
              const node = findNode(tree, id); if (!node || !node.children.length) return null;
              return <CollapseBtn key={`cb-${id}`} pos={pos} collapsed={coll.has(id)} count={countDesc(node)} color={node.color} onClick={() => toggle(id)} />;
            })}
          </svg>
        </div>
        <ZoomControls zoom={zoom} onIn={onZoomIn} onOut={onZoomOut} onReset={onReset} onFit={onFit} />
      </div>

      {drag && dragNode && <DragGhost node={dragNode} x={drag.curX} y={drag.curY} />}
      <style>{`
        @keyframes dashAnim { to { stroke-dashoffset: -18; } }
        @keyframes fadeIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
      `}</style>
    </div>
  );
}
