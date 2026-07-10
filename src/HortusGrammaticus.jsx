import { useState, useRef, useEffect, useMemo } from "react";

// ————————————————————————————————————————————————
// HORTUS GRAMMATICUS
// A cyanotype herbarium of rewriting systems.
// White specimens pressed on Prussian blue,
// after Anna Atkins (1843) & Aristid Lindenmayer (1968).
// Now with a seminarium — a seed bed of graph paper
// where the first generation is drawn by hand
// and the grammar writes itself.
// ————————————————————————————————————————————————

const GOLDEN = 137.50776405003785;
// The golden angle for a BRANCH, measured from the underside — the stem keeps
// going and the branch opens 180° − 137.508° away from it. Golden-angle ferns.
const PHI_BRANCH = 180 - GOLDEN;
const MAX_LEN = 260000; // cap on expanded grammar string
const MAX_SEGS = 90000; // cap on drawn segments

const C = {
  // The light page — the vague blue-grey of the Northumberland sky, the same
  // easy-to-look-at ground as or-ni-thology.cloud. The dark is lifted off.
  page: "#e6eaec",
  // A hair lighter than the sky — the drawer's own ground, so the potting
  // bench reads as a raised instrument on the page (flat, no shadow).
  panel: "#eef1f3",
  // The plates stay Prussian blue: the cyanotype soul is kept.
  plate: "#12314f",
  plateGlow: "#1b4266",
  // Ink ON THE LIGHT PAGE — dark blue on light, so the eyes stay sensible.
  // (It's the plate's own blue, so the text and the plates rhyme.)
  ink: "#12314f",
  faded: "#3f5a6b",
  dim: "#586f7d",
  // The gold accent, darkened so it reads on the light page.
  gold: "#9c6b1f",
  // Ink ON THE PLATES stays light — white specimens pressed on Prussian blue.
  onInk: "#eaf3f6",
  onFaded: "#a9c1cd",
  onDim: "#8ba4b3",
  // The plate's own light gold — the seed-bed root and its hover glow.
  goldPlate: "#d3ab6b",
  // Specimen lines, drawn light on the plate.
  line: "rgba(234,243,246,0.9)",
  // Leaf mode — the plate goes transparent and the tree goes living:
  // brown wood, translucent green leaves, straight onto the sky.
  branch: "#5e4426",
  leafFill: "rgba(74,124,63,0.25)",
  leafStroke: "rgba(74,124,63,0.5)",
};

const PRESETS = [
  {
    // First in the drawer — the plant in Alison's own hand leads the row.
    id: "hand",
    type: "d",
    latin: "Planta manuscripta",
    common: "the hand-written plant",
  },
  {
    id: "fern",
    type: "l",
    latin: "Filix mathematica",
    common: "the grammatical fern",
    axiom: "X",
    rules: "X → F+[[X]-X]-F[-FX]+X\nF → FF",
    angle: 25,
    iterations: 6,
    maxIter: 7,
    wildness: 0,
  },
  {
    id: "tree",
    type: "l",
    latin: "Arbor recursiva",
    common: "the recursive tree",
    axiom: "F",
    rules: "F → FF+[+F-F-F]-[-F+F+F]",
    angle: 22.5,
    iterations: 4,
    maxIter: 5,
    wildness: 1.5,
  },
  {
    id: "seaweed",
    type: "l",
    latin: "Fucus iterativus",
    common: "drifting weed",
    axiom: "F",
    rules: "F → F[+F]F[-F]F",
    angle: 25.7,
    iterations: 5,
    maxIter: 6,
    wildness: 2,
  },
  {
    id: "bramble",
    type: "l",
    latin: "Dumus ramosus",
    common: "the bramble",
    axiom: "F",
    rules: "F → F[+FF][-FF]F[-F][+F]F",
    angle: 35,
    iterations: 4,
    maxIter: 4,
    wildness: 0,
  },
  {
    id: "sunflower",
    type: "p",
    latin: "Helianthus aureus",
    common: "the counting flower",
    divergence: GOLDEN,
    count: 620,
    size: 4,
  },
];

// The app opens on the fern — Filix mathematica is too beautiful not to greet
// you — even though Planta manuscripta leads the drawer for playing.
const FERN = PRESETS.find((p) => p.id === "fern");

// deterministic little chaos
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseRules(text) {
  const rules = {};
  text
    .replace(/−/g, "-")
    .split(/\n+/)
    .forEach((line) => {
      const parts = line.split(/→|->|=/);
      if (parts.length >= 2) {
        const k = parts[0].trim();
        const v = parts.slice(1).join("").replace(/\s+/g, "");
        if (k.length === 1 && v) rules[k] = v;
      }
    });
  return rules;
}

function expand(axiom, rules, iterations) {
  let s = axiom.replace(/\s+/g, "");
  let gens = 0;
  for (let i = 0; i < iterations; i++) {
    let next = "";
    for (const ch of s) next += rules[ch] ?? ch;
    if (next.length > MAX_LEN) return { s, gens, pruned: true };
    s = next;
    gens++;
  }
  return { s, gens, pruned: false };
}

function turtleSegments(s, angleDeg, wildness, seed) {
  const rad = (angleDeg * Math.PI) / 180;
  const rand = mulberry32(seed);
  const segs = [];
  let x = 0,
    y = 0,
    a = -Math.PI / 2,
    depth = 0;
  const stack = [];
  let minX = 0,
    maxX = 0,
    minY = 0,
    maxY = 0;
  const step = 10;
  // branch tips — where leaves belong. A tip is the end of a branch that
  // actually drew something: we mark one whenever a branch closes (`]`) or the
  // string ends while the pen has drawn since the last fork. Stored as
  // [x, y, heading] triples so a leaf can point the way the twig was going.
  const tips = [];
  let justDrew = false;
  for (const ch of s) {
    if (ch === "F" || ch === "G") {
      if (wildness > 0) a += (rand() - 0.5) * wildness * 0.045;
      const nx = x + step * Math.cos(a);
      const ny = y + step * Math.sin(a);
      segs.push(x, y, nx, ny, depth);
      x = nx;
      y = ny;
      justDrew = true;
      if (nx < minX) minX = nx;
      if (nx > maxX) maxX = nx;
      if (ny < minY) minY = ny;
      if (ny > maxY) maxY = ny;
      if (segs.length / 5 >= MAX_SEGS) break;
    } else if (ch === "+") a -= rad;
    else if (ch === "-") a += rad;
    else if (ch === "[") {
      stack.push(x, y, a, depth);
      depth = Math.min(depth + 1, 12);
      justDrew = false; // a fresh branch hasn't drawn yet
    } else if (ch === "]") {
      if (justDrew) tips.push(x, y, a); // the branch we're closing ended here
      if (stack.length >= 4) {
        depth = stack.pop();
        a = stack.pop();
        y = stack.pop();
        x = stack.pop();
      }
      justDrew = false;
    }
  }
  if (justDrew) tips.push(x, y, a); // an unbracketed trunk ends in a tip too
  return { segs, tips, bbox: [minX, minY, maxX, maxY] };
}

// ————————————————————————————————————————————————
// THE SEMINARIUM — hand-drawn strokes → grammar
//
// Edges live on a lattice. Keys: "H:x,y" is the edge
// from node (x,y) to (x+1,y); "V:x,y" runs (x,y)→(x,y+1).
// The largest connected drawing is the plant; its lowest
// node is the root; a depth-first walk over the strokes
// transcribes it into turtle speech, bracketing every
// side-branch so the pen always finds its way home.
//
// GEMMAE — buds. Tap a lattice crossing to plant one.
// A bud becomes a silent X in the grammar: the walk speaks
// "[X]" when it passes, and the rules become fern-shaped —
//   X → the gesture (with X's at the buds)
//   F → FF (old wood stretches)
// so the whole pattern regrows at every bud, each
// generation, pointing the way the walk was going.
// ————————————————————————————————————————————————

const TRAY_N = 10; // cells per side
const TRAY_CELL = 30;
const TRAY_PAD = 14;
const TRAY_VB = TRAY_N * TRAY_CELL + TRAY_PAD * 2;

function edgeEnds(key) {
  const kind = key[0];
  const [x, y] = key.slice(2).split(",").map(Number);
  return kind === "H"
    ? [x, y, x + 1, y]
    : [x, y, x, y + 1];
}

function deriveGrammar(strokes, buds) {
  const empty = {
    rule: "",
    rooted: new Set(),
    root: null,
    edgeCount: 0,
    loose: 0,
    dynMax: 8,
    hasBuds: false,
    buddedNodes: new Set(),
  };
  if (!strokes || strokes.size === 0) return empty;

  // adjacency: "x,y" → [{to, dir, key}] · dirs: 0 right, 1 down, 2 left, 3 up
  const adj = new Map();
  const addAdj = (from, to, dir, key) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push({ to, dir, key });
  };
  for (const key of strokes) {
    const [x1, y1, x2, y2] = edgeEnds(key);
    const a = `${x1},${y1}`;
    const b = `${x2},${y2}`;
    if (key[0] === "H") {
      addAdj(a, b, 0, key);
      addAdj(b, a, 2, key);
    } else {
      addAdj(a, b, 1, key);
      addAdj(b, a, 3, key);
    }
  }

  // connected components; the plant is the one with the most strokes
  const seen = new Set();
  let best = null;
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const nodes = [];
    const edgeKeys = new Set();
    const q = [start];
    seen.add(start);
    while (q.length) {
      const n = q.pop();
      nodes.push(n);
      for (const e of adj.get(n)) {
        edgeKeys.add(e.key);
        if (!seen.has(e.to)) {
          seen.add(e.to);
          q.push(e.to);
        }
      }
    }
    let maxY = -1;
    for (const n of nodes) {
      const y = +n.split(",")[1];
      if (y > maxY) maxY = y;
    }
    const cand = { nodes, edgeKeys, maxY };
    if (
      !best ||
      cand.edgeKeys.size > best.edgeKeys.size ||
      (cand.edgeKeys.size === best.edgeKeys.size && cand.maxY > best.maxY)
    )
      best = cand;
  }

  // the root: lowest node of the plant, nearest the middle if tied
  let root = null,
    rx = 0,
    ry = -1;
  for (const n of best.nodes) {
    const [x, y] = n.split(",").map(Number);
    if (y > ry || (y === ry && Math.abs(x - TRAY_N / 2) < Math.abs(rx - TRAY_N / 2))) {
      root = n;
      rx = x;
      ry = y;
    }
  }

  // depth-first transcription over edges (cycles welcome — each
  // stroke is spoken exactly once; brackets bring the pen home)
  const visited = new Set();
  const out = [];
  // a bud speaks once, the first time the walk reaches its crossing —
  // bracketed, so the regrown pattern is a side-shoot and the pen carries on
  const buddedNodes = new Set();
  const maybeBud = (node) => {
    if (buds && buds.has(node) && !buddedNodes.has(node)) {
      buddedNodes.add(node);
      out.push("[X]");
    }
  };
  const TURN = ["", "-", "++", "+"]; // by (dir − heading) mod 4
  const PRIO = { 3: 0, 2: 1, 1: 2, 0: 3 }; // branch left & right first, run straight last
  const walk = (node, heading) => {
    for (;;) {
      const un = adj.get(node).filter((e) => !visited.has(e.key));
      if (un.length === 0) return;
      un.sort(
        (a, b) => PRIO[(a.dir - heading + 4) % 4] - PRIO[(b.dir - heading + 4) % 4]
      );
      const e = un[0];
      visited.add(e.key);
      const t = TURN[(e.dir - heading + 4) % 4];
      if (un.length === 1) {
        out.push(t + "F");
        node = e.to;
        heading = e.dir;
        maybeBud(node);
      } else {
        out.push("[" + t + "F");
        maybeBud(e.to);
        walk(e.to, e.dir);
        out.push("]");
      }
    }
  };
  maybeBud(root); // a bud on the root itself is welcome
  walk(root, 3); // the pen begins at the root, facing up

  const edgeCount = best.edgeKeys.size;
  const hasBuds = buddedNodes.size > 0;
  let dynMax;
  if (hasBuds) {
    // fern arithmetic: F(n+1) = 2F(n) + E·X(n), X(n+1) = B·X(n) — walk the
    // recurrence until the wood outgrows the pot, that's the slider's ceiling
    const E = edgeCount;
    const B = buddedNodes.size;
    let f = 0,
      x = 1,
      n = 0;
    while (n < 8) {
      const nf = 2 * f + E * x;
      if (nf > 120000) break;
      f = nf;
      x = B * x;
      n++;
    }
    dynMax = Math.max(2, n);
  } else {
    const E = Math.max(2, edgeCount);
    dynMax = Math.max(2, Math.min(8, Math.floor(Math.log(120000) / Math.log(E))));
  }
  return {
    rule: out.join(""),
    rooted: best.edgeKeys,
    root: [rx, ry],
    edgeCount,
    loose: strokes.size - edgeCount,
    dynMax,
    hasBuds,
    buddedNodes,
  };
}

// the drawable graph paper. Edges are inked by tap or drag; the crossings
// themselves take a tap to plant (or lift) a gemma — a bud.
function SeedTray({ strokes, setStrokes, buds, setBuds, drawn }) {
  const svgRef = useRef(null);
  const drag = useRef({ active: false, mode: null });
  const [hover, setHover] = useState(null); // an edge key, or "N:x,y" for a crossing

  const toGrid = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const s = TRAY_VB / r.width;
    return [
      ((e.clientX - r.left) * s - TRAY_PAD) / TRAY_CELL,
      ((e.clientY - r.top) * s - TRAY_PAD) / TRAY_CELL,
    ];
  };

  // nearest edge to a point, in cell units; dead zones near
  // the lattice points keep corners unambiguous
  const pick = (gx, gy) => {
    let h = null,
      v = null;
    const hy = Math.round(gy),
      hx = Math.floor(gx);
    if (hy >= 0 && hy <= TRAY_N && hx >= 0 && hx < TRAY_N) {
      const t = gx - hx;
      const d = Math.abs(gy - hy);
      if (t > 0.12 && t < 0.88 && d < 0.35) h = { key: `H:${hx},${hy}`, d };
    }
    const vx = Math.round(gx),
      vy = Math.floor(gy);
    if (vx >= 0 && vx <= TRAY_N && vy >= 0 && vy < TRAY_N) {
      const t = gy - vy;
      const d = Math.abs(gx - vx);
      if (t > 0.12 && t < 0.88 && d < 0.35) v = { key: `V:${vx},${vy}`, d };
    }
    if (h && v) return h.d <= v.d ? h.key : v.key;
    return (h ?? v)?.key ?? null;
  };

  // nearest lattice crossing — the dead zones pick() leaves around the
  // corners are exactly where a bud tap lands
  const pickNode = (gx, gy) => {
    const nx = Math.round(gx),
      ny = Math.round(gy);
    if (nx < 0 || nx > TRAY_N || ny < 0 || ny > TRAY_N) return null;
    return Math.hypot(gx - nx, gy - ny) < 0.28 ? `${nx},${ny}` : null;
  };

  const setEdge = (key, on) => {
    setStrokes((prev) => {
      if (prev.has(key) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const onDown = (e) => {
    e.preventDefault();
    svgRef.current.setPointerCapture?.(e.pointerId);
    const [gx, gy] = toGrid(e);
    const key = pick(gx, gy);
    if (!key) {
      // no edge under the finger — a crossing means a bud, in or out
      const node = pickNode(gx, gy);
      if (node) {
        setBuds((prev) => {
          const next = new Set(prev);
          if (next.has(node)) next.delete(node);
          else next.add(node);
          return next;
        });
        drag.current.active = false;
        drag.current.mode = null;
        return;
      }
    }
    drag.current.active = true;
    drag.current.mode = key ? !strokes.has(key) : null;
    if (key) setEdge(key, drag.current.mode);
  };
  const onMove = (e) => {
    const [gx, gy] = toGrid(e);
    const key = pick(gx, gy);
    if (!drag.current.active) {
      const node = key ? null : pickNode(gx, gy);
      setHover(key ?? (node ? `N:${node}` : null));
      return;
    }
    if (!key) return;
    if (drag.current.mode === null) drag.current.mode = !strokes.has(key);
    setEdge(key, drag.current.mode);
  };
  const onUp = () => {
    drag.current.active = false;
    drag.current.mode = null;
  };

  const px = (n) => TRAY_PAD + n * TRAY_CELL;
  const gridLines = [];
  for (let i = 0; i <= TRAY_N; i++) {
    gridLines.push(
      <line key={`gh${i}`} x1={px(0)} y1={px(i)} x2={px(TRAY_N)} y2={px(i)} stroke={C.plateGlow} strokeWidth="1" />,
      <line key={`gv${i}`} x1={px(i)} y1={px(0)} x2={px(i)} y2={px(TRAY_N)} stroke={C.plateGlow} strokeWidth="1" />
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${TRAY_VB} ${TRAY_VB}`}
      className="w-full rounded-sm"
      style={{
        display: "block",
        touchAction: "none",
        cursor: "crosshair",
        userSelect: "none",
        border: `1px solid ${C.plateGlow}`,
        background: C.plate,
      }}
      role="application"
      aria-label="Seed bed — a drawable grid. Ink edges to compose the first generation; tap a crossing to plant a bud."
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => setHover(null)}
    >
      {gridLines}
      {hover && hover[0] !== "N" && !strokes.has(hover) && (
        <line
          {...(() => {
            const [x1, y1, x2, y2] = edgeEnds(hover);
            return { x1: px(x1), y1: px(y1), x2: px(x2), y2: px(y2) };
          })()}
          stroke={C.goldPlate}
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.35"
        />
      )}
      {hover && hover[0] === "N" && (
        <circle
          {...(() => {
            const [x, y] = hover.slice(2).split(",").map(Number);
            return { cx: px(x), cy: px(y) };
          })()}
          r="6"
          fill="none"
          stroke={C.goldPlate}
          strokeWidth="1.5"
          opacity="0.35"
        />
      )}
      {[...strokes].map((key) => {
        const [x1, y1, x2, y2] = edgeEnds(key);
        const rooted = drawn.rooted.has(key);
        return (
          <line
            key={key}
            x1={px(x1)}
            y1={px(y1)}
            x2={px(x2)}
            y2={px(y2)}
            stroke={C.onInk}
            strokeWidth={rooted ? 3.5 : 2.5}
            strokeLinecap="round"
            opacity={rooted ? (hover === key ? 0.7 : 0.95) : 0.3}
          />
        );
      })}
      {/* gemmae — hollow gold rings; pale when not joined to the plant */}
      {[...buds].map((node) => {
        const [x, y] = node.split(",").map(Number);
        const rooted = drawn.buddedNodes.has(node);
        return (
          <circle
            key={`b${node}`}
            cx={px(x)}
            cy={px(y)}
            r="4.5"
            fill={C.plate}
            stroke={C.goldPlate}
            strokeWidth="1.5"
            opacity={rooted ? 0.95 : 0.35}
          />
        );
      })}
      {drawn.root && (
        <>
          <circle cx={px(drawn.root[0])} cy={px(drawn.root[1])} r="7" fill="none" stroke={C.goldPlate} strokeWidth="1" opacity="0.5" />
          <circle cx={px(drawn.root[0])} cy={px(drawn.root[1])} r="3.5" fill={C.goldPlate} />
        </>
      )}
    </svg>
  );
}

// ————————————————————————————————————————————————
// One card of the potting-bench drawer — a fixed-width cell divided from its
// neighbour by a blue rule, a small mono caption + value up top, the control
// below. The drawer scrolls sideways when the cards outrun the phone, exactly
// as Mooring's tool drawer does. Every cell is the same fixed height: a tool
// that needs more room goes LONG (another cell), never TALL.
const DRAWER_H = 76;

function DrawerCard({ label, value, valueColor, width = 152, last = false, children }) {
  return (
    <div
      style={{
        flex: "0 0 auto",
        width,
        height: DRAWER_H,
        boxSizing: "border-box",
        borderRight: last ? "none" : `1px solid ${C.plateGlow}`,
        padding: "11px 14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 7,
      }}
    >
      {(label || value != null) && (
        <div className="flex justify-between items-baseline" style={{ fontSize: 11 }}>
          {label && (
            <span style={{ color: C.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {label}
            </span>
          )}
          {value != null && <span style={{ color: valueColor || C.ink }}>{value}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

// A plain drawer action — out of its pill: small uppercase text sitting in its
// own compartment, marked with the same gold radix dot the specimens use when
// something is switched on.
function DrawerAction({ onClick, active = false, dot = false, title, last = false, width = 118, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={dot ? active : undefined}
      style={{
        flex: "0 0 auto",
        width,
        height: DRAWER_H,
        boxSizing: "border-box",
        border: "none",
        borderRight: last ? "none" : `1px solid ${C.plateGlow}`,
        background: "transparent",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: active ? C.ink : C.faded,
        whiteSpace: "nowrap",
      }}
    >
      <span>{children}</span>
      {dot && (
        <span style={{ fontSize: 8, lineHeight: 1, color: active ? C.gold : "transparent" }}>●</span>
      )}
    </button>
  );
}

// The little round snap chip — gold-rimmed, filled when the dial sits on it.
function SnapChip({ on, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="px-2 rounded-full"
      style={{
        border: `1px solid ${C.gold}`,
        color: on ? C.page : C.gold,
        background: on ? C.gold : "transparent",
        fontSize: 11,
        lineHeight: "18px",
      }}
    >
      {children}
    </button>
  );
}

// ————————————————————————————————————————————————

export default function HortusGrammaticus() {
  // Open on the fern, for admiring; Planta manuscripta waits first in the
  // drawer, one tap away, for playing.
  const [presetId, setPresetId] = useState("fern");
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];

  const [axiom, setAxiom] = useState(FERN.axiom);
  const [rulesText, setRulesText] = useState(FERN.rules);
  const [iterations, setIterations] = useState(FERN.iterations);
  const [maxIter, setMaxIter] = useState(FERN.maxIter);
  const [angle, setAngle] = useState(FERN.angle);
  const [wildness, setWildness] = useState(FERN.wildness);
  const [seed, setSeed] = useState(7);
  const [leaves, setLeaves] = useState(false); // little translucent leaves at the branch tips
  const [custom, setCustom] = useState(false);
  const [mode, setMode] = useState("l"); // "l" grammar · "p" phyllotaxis · "d" drawn by hand

  // draft grammar (edited but not yet grown)
  const [draftAxiom, setDraftAxiom] = useState(FERN.axiom);
  const [draftRules, setDraftRules] = useState(FERN.rules);
  const [showGrammar, setShowGrammar] = useState(false);

  // hand-drawn strokes on the seed bed (survive changes of specimen),
  // and the gemmae — budded crossings where the pattern regrows
  const [strokes, setStrokes] = useState(() => new Set());
  const [buds, setBuds] = useState(() => new Set());

  // phyllotaxis state
  const [divergence, setDivergence] = useState(GOLDEN);
  const [count, setCount] = useState(620);
  const [floretSize, setFloretSize] = useState(4);

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 600, h: 600 });
  const animateNext = useRef(true);
  const rafRef = useRef(0);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function selectPreset(p) {
    setPresetId(p.id);
    setCustom(false);
    animateNext.current = true;
    if (p.type === "l") {
      setMode("l");
      setAxiom(p.axiom);
      setRulesText(p.rules);
      setDraftAxiom(p.axiom);
      setDraftRules(p.rules);
      setIterations(p.iterations);
      setMaxIter(p.maxIter);
      setAngle(p.angle);
      setWildness(p.wildness);
    } else if (p.type === "d") {
      setMode("d");
      setIterations(1); // begin with the drawing itself
      setAngle(90); // true to the graph paper
      setWildness(0);
    } else {
      setMode("p");
      setDivergence(p.divergence);
      setCount(p.count);
      setFloretSize(p.size);
    }
  }

  function growAgain() {
    animateNext.current = true;
    setSeed((s) => (s * 16807 + 13) % 2147483647);
  }

  // press the current plate into a PNG — an arboretum for the phone.
  // (In leaf mode the plate is transparent, so the tree travels bare.)
  function downloadPlate() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      const name = label.latin.toLowerCase().replace(/[^a-z]+/g, "-");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}-${stamp}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }

  function applyGrammar() {
    setAxiom(draftAxiom);
    setRulesText(draftRules);
    setCustom(true);
    setMaxIter(8);
    animateNext.current = true;
    setSeed((s) => s + 1);
  }

  // the seed bed's transcription
  const drawn = useMemo(() => deriveGrammar(strokes, buds), [strokes, buds]);

  // carry the hand-written rule into the text editor for refinement
  function refineAsText() {
    const ax = drawn.hasBuds ? "X" : "F";
    const r = drawn.hasBuds ? `X → ${drawn.rule}\nF → FF` : `F → ${drawn.rule}`;
    setMode("l");
    setCustom(true);
    setAxiom(ax);
    setRulesText(r);
    setDraftAxiom(ax);
    setDraftRules(r);
    setMaxIter(8);
    setShowGrammar(true);
    animateNext.current = true;
  }

  // resize observer
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDims({ w: Math.max(280, r.width), h: Math.max(280, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // grow the grammar
  const grown = useMemo(() => {
    if (mode === "p") return null;
    let ax, rules, iters;
    if (mode === "d") {
      if (!drawn.rule) return null;
      if (drawn.hasBuds) {
        // fern-shaped: the gesture regrows at every bud, the wood stretches
        ax = "X";
        rules = { X: drawn.rule, F: "FF" };
      } else {
        ax = "F";
        rules = { F: drawn.rule };
      }
      iters = Math.min(iterations, drawn.dynMax);
    } else {
      ax = axiom;
      rules = parseRules(rulesText);
      iters = iterations;
    }
    const { s, gens, pruned } = expand(ax, rules, iters);
    const t = turtleSegments(s, angle, wildness, seed);
    return { ...t, gens, pruned };
  }, [mode, axiom, rulesText, iterations, angle, wildness, seed, drawn]);

  // leaf mode turns the whole plate living: no cyanotype wash (the sky shows
  // through), brown wood, translucent green leaves. Phyllotaxis stays blue.
  const leafy = leaves && mode !== "p";

  // render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (leafy) {
      // a transparent plate — the tree sits straight on the page
      ctx.clearRect(0, 0, dims.w, dims.h);
    } else {
      // cyanotype plate wash
      const g = ctx.createRadialGradient(
        dims.w / 2,
        dims.h / 2,
        Math.min(dims.w, dims.h) * 0.1,
        dims.w / 2,
        dims.h / 2,
        Math.max(dims.w, dims.h) * 0.75
      );
      g.addColorStop(0, C.plateGlow);
      g.addColorStop(1, C.plate);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, dims.w, dims.h);
    }

    cancelAnimationFrame(rafRef.current);
    const animate = animateNext.current && !reducedMotion;
    animateNext.current = false;
    const pad = 34;

    if (mode !== "p" && grown) {
      const { segs, tips, bbox } = grown;
      const [minX, minY, maxX, maxY] = bbox;
      const bw = Math.max(1, maxX - minX);
      const bh = Math.max(1, maxY - minY);
      const scale = Math.min((dims.w - pad * 2) / bw, (dims.h - pad * 2) / bh);
      const ox = (dims.w - bw * scale) / 2 - minX * scale;
      const oy = (dims.h - bh * scale) / 2 - minY * scale;
      const n = segs.length / 5;
      ctx.lineCap = "round";

      const drawRange = (from, to) => {
        for (let i = from; i < to; i++) {
          const j = i * 5;
          const d = segs[j + 4];
          ctx.strokeStyle = leafy ? C.branch : C.line;
          ctx.globalAlpha = Math.max(0.35, 0.95 - d * 0.055);
          ctx.lineWidth = Math.max(0.55, 2.4 - d * 0.3);
          ctx.beginPath();
          ctx.moveTo(segs[j] * scale + ox, segs[j + 1] * scale + oy);
          ctx.lineTo(segs[j + 2] * scale + ox, segs[j + 3] * scale + oy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      };

      // little translucent green leaves at the branch tips — basic almond
      // shapes pointing the way each twig was heading, see-through so
      // overlapping leaves build up into soft foliage. Only the upper reaches
      // of the tree get them; the lower trunk stays bare wood.
      const drawLeaves = () => {
        if (!leaves || !tips.length) return;
        // proportional to the twig (so a dense fern gets small leaves that
        // don't blob together), but capped so a sparse hand-drawn plant with
        // very long twigs still gets little basic leaves, not giant ones.
        const len = Math.min(18 * scale, 28);
        const wid = Math.min(6 * scale, 9);
        const yCut = minY + (maxY - minY) * 0.7 + 0.001; // leaves live above this line
        ctx.lineCap = "round";
        ctx.fillStyle = C.leafFill;
        ctx.strokeStyle = C.leafStroke;
        ctx.lineWidth = Math.max(0.4, Math.min(1, scale * 1.6));
        for (let k = 0; k < tips.length; k += 3) {
          if (tips[k + 1] > yCut) continue;
          const bx = tips[k] * scale + ox;
          const by = tips[k + 1] * scale + oy;
          const ang = tips[k + 2];
          const tx = bx + len * Math.cos(ang);
          const ty = by + len * Math.sin(ang);
          const mx = bx + len * 0.5 * Math.cos(ang);
          const my = by + len * 0.5 * Math.sin(ang);
          const px = Math.cos(ang + Math.PI / 2);
          const py = Math.sin(ang + Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(mx + px * wid, my + py * wid, tx, ty);
          ctx.quadraticCurveTo(mx - px * wid, my - py * wid, bx, by);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      };

      if (!animate || n < 60) {
        drawRange(0, n);
        drawLeaves();
      } else {
        const frames = 85;
        const chunk = Math.max(1, Math.ceil(n / frames));
        let i = 0;
        const tick = () => {
          const next = Math.min(n, i + chunk);
          drawRange(i, next);
          i = next;
          if (i < n) rafRef.current = requestAnimationFrame(tick);
          else drawLeaves();
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    if (mode === "p") {
      const N = count;
      const maxR = Math.min(dims.w, dims.h) / 2 - pad;
      const c = maxR / Math.sqrt(N);
      const cx = dims.w / 2;
      const cy = dims.h / 2;
      const dRad = (divergence * Math.PI) / 180;
      const golden = Math.abs(divergence - GOLDEN) < 0.02;

      const drawDot = (i) => {
        const r = c * Math.sqrt(i);
        const th = i * dRad;
        const dr = floretSize * (0.3 + 0.7 * Math.sqrt(i / N));
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(th), cy + r * Math.sin(th), dr, 0, Math.PI * 2);
        ctx.fillStyle = golden
          ? `rgba(226,205,160,${0.55 + 0.4 * (i / N)})`
          : `rgba(234,243,246,${0.5 + 0.42 * (i / N)})`;
        ctx.fill();
      };

      if (!animate) {
        for (let i = 1; i <= N; i++) drawDot(i);
      } else {
        const frames = 80;
        const chunk = Math.max(1, Math.ceil(N / frames));
        let i = 1;
        const tick = () => {
          const next = Math.min(N + 1, i + chunk);
          for (; i < next; i++) drawDot(i);
          if (i <= N) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [mode, grown, leaves, divergence, count, floretSize, dims, reducedMotion]);

  const nearGolden = Math.abs(divergence - GOLDEN) < 0.02;
  const onSquare = Math.abs(angle - 90) < 0.25;
  const onPhiAngle = Math.abs(angle - PHI_BRANCH) < 0.02;
  const angleDisp = Math.round(angle * 10) / 10;

  const genMax = mode === "d" ? drawn.dynMax : maxIter;
  const genValue = Math.min(iterations, genMax);

  const label =
    mode === "d"
      ? {
          latin: "Planta manuscripta",
          common: "the hand-written plant",
        }
      : mode === "l"
      ? {
          latin: custom ? "Specimen incognita" : preset.latin,
          common: custom ? "raised from your own grammar" : preset.common,
        }
      : {
          latin: preset.latin,
          common: preset.common,
        };

  const sliderStyle = { accentColor: C.ink, width: "100%" };
  const labelCls = "text-xs tracking-widest uppercase";

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: C.page, color: C.ink, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}
    >
      <style>{`
        input[type=range]{height:20px;background:transparent;}
        button:focus-visible, input:focus-visible, textarea:focus-visible, [role=button]:focus-visible, [role=application]:focus-visible{outline:2px solid ${C.gold};outline-offset:2px;}
        ::selection{background:${C.gold};color:${C.page};}
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {/* ——— header ——— brutally cut off, on purpose: a blank space held
            open for an illustrated title Alison will grow with the toy itself
            (she can grow words into trees now). */}
        <header aria-hidden="true" style={{ height: "clamp(90px, 14vh, 160px)" }} />

        {/* Everything stacks in one centred column now: the potting-bench
            drawer of controls on top, the tree plate below it, then (hand mode)
            the seed bed and the grammar it writes. Adjust up top, watch the
            plate change below — the whole point of the rearrange. */}
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {/* ——— the potting bench: a sideways-slidey drawer, Mooring-style ——— */}
          <div className={labelCls} style={{ color: C.dim, letterSpacing: "0.25em", marginBottom: 8 }}>
            The potting bench
          </div>
          <div
            style={{
              display: "flex",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              border: `1px solid ${C.ink}`,
              borderRadius: 2,
              background: C.panel,
            }}
          >
            {/* specimen chooser — each plant is its own plain drawer section
                now, no pill borders: a row of italic Latin names you swipe
                through, the chosen one quietly marked with a gold radix dot
                (the same mark as the seed bed's root). Keeps the drawer short
                and lets the plants be the focus. */}
            {PRESETS.map((p) => {
              const active = p.id === presetId && !custom;
              return (
                <button
                  key={p.id}
                  onClick={() => selectPreset(p)}
                  title={p.common}
                  style={{
                    flex: "0 0 auto",
                    height: DRAWER_H,
                    boxSizing: "border-box",
                    border: "none",
                    borderRight: `1px solid ${C.plateGlow}`,
                    background: "transparent",
                    cursor: "pointer",
                    padding: "11px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontStyle: "italic",
                    fontSize: "1rem",
                    fontWeight: active ? 500 : 400,
                    whiteSpace: "nowrap",
                    color: active ? C.ink : C.faded,
                  }}
                >
                  <span>{p.latin}</span>
                  {/* the radix dot: gold when chosen, transparent otherwise so
                      nothing shifts as you pick */}
                  <span style={{ fontSize: 8, lineHeight: 1, color: active ? C.gold : "transparent" }}>
                    ●
                  </span>
                </button>
              );
            })}

            {/* grammar & hand-drawn dials */}
            {mode !== "p" && (
              <>
                <DrawerCard label="Generations" value={genValue} width={150}>
                  <input
                    type="range"
                    min={1}
                    max={genMax}
                    step={1}
                    value={genValue}
                    onChange={(e) => setIterations(+e.target.value)}
                    style={sliderStyle}
                    aria-label="Generations"
                  />
                </DrawerCard>
                <DrawerCard
                  label="Angle"
                  value={`${angleDisp}°`}
                  valueColor={onSquare || onPhiAngle ? C.gold : C.ink}
                  width={150}
                >
                  <input
                    type="range"
                    min={2}
                    max={160}
                    step={0.5}
                    value={angle}
                    onChange={(e) => setAngle(+e.target.value)}
                    style={{ ...sliderStyle, accentColor: onSquare || onPhiAngle ? C.gold : C.ink }}
                    aria-label="Branching angle"
                  />
                </DrawerCard>
                <DrawerCard label="Snap" width={104}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                    <SnapChip on={onSquare} onClick={() => setAngle(90)} title="Snap to the right angle, 90°">
                      ∟
                    </SnapChip>
                    <SnapChip
                      on={onPhiAngle}
                      onClick={() => setAngle(PHI_BRANCH)}
                      title="Snap to the golden angle, measured from the underside of the branch — 42.492°"
                    >
                      φ
                    </SnapChip>
                  </div>
                </DrawerCard>
                <DrawerCard label="Wildness" value={wildness} width={150}>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={wildness}
                    onChange={(e) => setWildness(+e.target.value)}
                    style={sliderStyle}
                    aria-label="Wildness — organic angle jitter"
                  />
                </DrawerCard>
                <DrawerAction
                  onClick={() => setLeaves((v) => !v)}
                  active={leaves}
                  dot
                  width={96}
                  title="Leaves — the plate goes living"
                >
                  leaves
                </DrawerAction>
                <DrawerAction onClick={growAgain} width={118}>
                  grow again
                </DrawerAction>
                <DrawerAction onClick={downloadPlate} width={118} last title="Press this plate into a PNG">
                  download
                </DrawerAction>
              </>
            )}

            {/* phyllotaxis dials */}
            {mode === "p" && (
              <>
                <DrawerCard
                  label="Divergence"
                  value={`${divergence.toFixed(3)}°`}
                  valueColor={nearGolden ? C.gold : C.ink}
                  width={190}
                >
                  <input
                    type="range"
                    min={100}
                    max={170}
                    step={0.005}
                    value={divergence}
                    onChange={(e) => setDivergence(+e.target.value)}
                    style={{ ...sliderStyle, accentColor: nearGolden ? C.gold : C.ink }}
                    aria-label="Divergence angle between successive florets"
                  />
                </DrawerCard>
                <DrawerCard label="Snap" width={78}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <SnapChip
                      on={nearGolden}
                      onClick={() => setDivergence(GOLDEN)}
                      title="Snap to the golden angle, 137.508°"
                    >
                      φ
                    </SnapChip>
                  </div>
                </DrawerCard>
                <DrawerCard label="Florets" value={count} width={150}>
                  <input
                    type="range"
                    min={50}
                    max={1500}
                    step={10}
                    value={count}
                    onChange={(e) => setCount(+e.target.value)}
                    style={sliderStyle}
                    aria-label="Number of florets"
                  />
                </DrawerCard>
                <DrawerCard label="Floret size" value={floretSize} width={150}>
                  <input
                    type="range"
                    min={1}
                    max={9}
                    step={0.5}
                    value={floretSize}
                    onChange={(e) => setFloretSize(+e.target.value)}
                    style={sliderStyle}
                    aria-label="Floret size"
                  />
                </DrawerCard>
                <DrawerAction
                  onClick={() => {
                    animateNext.current = true;
                    setCount((c) => c);
                    setSeed((s) => s + 1);
                    setDivergence((d) => d + 0.0000001);
                  }}
                  width={128}
                >
                  bloom again
                </DrawerAction>
                <DrawerAction onClick={downloadPlate} width={118} last title="Press this plate into a PNG">
                  download
                </DrawerAction>
              </>
            )}
          </div>

          {/* ——— the tree plate ——— */}
          <div
            className="relative rounded-sm overflow-hidden"
            style={{
              // A crisp 1px plate edge, and nothing else — no drop shadow.
              // Flat: ink on a sheet, a sheet on the sky.
              marginTop: 18,
              border: `1px solid ${C.plateGlow}`,
            }}
          >
            <div ref={wrapRef} className="w-full" style={{ aspectRatio: "1 / 1.05" }}>
              <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
            </div>

            {/* empty seed bed, empty plate */}
            {mode === "d" && !drawn.rule && (
              <div
                className="absolute inset-0 flex items-center justify-center px-10 text-center pointer-events-none"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontStyle: "italic",
                  fontSize: "1.2rem",
                  color: leafy ? C.faded : C.onFaded,
                  lineHeight: 1.5,
                }}
              >
                Nothing sown yet — ink a few edges in the seed bed below.
              </div>
            )}

            {/* specimen label — small, up in the corner where the plate
                number used to live, out of the tree's way */}
            <div className="absolute top-3 right-4 text-right pointer-events-none">
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontStyle: "italic",
                  fontSize: "1.05rem",
                  lineHeight: 1.1,
                  color: leafy ? C.ink : C.onInk,
                }}
              >
                {label.latin}
              </div>
              <div className="text-xs mt-0.5" style={{ color: leafy ? C.faded : C.onFaded }}>
                {label.common}
              </div>
            </div>
          </div>

          {grown?.pruned && mode !== "p" && (
            <p className="mt-2 text-xs" style={{ color: C.gold }}>
              Pruned at generation {grown.gens} — the grammar outgrew its pot.
            </p>
          )}

          {/* ——— the seed bed, just below the tree (hand mode) ——— */}
          {mode === "d" && (
            <div style={{ maxWidth: 460, margin: "22px auto 0" }}>
              <div className={labelCls} style={{ color: C.dim, letterSpacing: "0.25em", marginBottom: 8 }}>
                Seminarium — the seed bed
              </div>

              <SeedTray strokes={strokes} setStrokes={setStrokes} buds={buds} setBuds={setBuds} drawn={drawn} />

              {drawn.rule && (
                <p className="mt-2 text-xs leading-relaxed" style={{ color: C.dim }}>
                  <span style={{ color: C.gold }}>●</span> radix ·{" "}
                  <span style={{ color: C.gold }}>○</span> gemma — tap a crossing
                  {drawn.loose > 0 && <> · pale strokes aren't joined to the root</>}
                </p>
              )}

              {/* the grammar it wrote, below the grid */}
              <div className="mt-4">
                <div className={labelCls} style={{ color: C.dim, letterSpacing: "0.25em" }}>
                  The grammar, self-written
                </div>
                <div
                  className="mt-2 px-2 py-1.5 text-sm rounded-sm overflow-y-auto"
                  style={{
                    background: C.plate,
                    border: `1px solid ${C.plateGlow}`,
                    color: C.onInk,
                    maxHeight: "8rem",
                  }}
                >
                  <div>
                    <span style={{ color: C.onDim }}>axiom&nbsp;&nbsp;</span>
                    {drawn.hasBuds ? "X" : "F"}
                  </div>
                  <div style={{ wordBreak: "break-all" }}>
                    <span style={{ color: C.onDim }}>{drawn.hasBuds ? "X → " : "F → "}</span>
                    {drawn.rule || <span style={{ color: C.onDim }}>…</span>}
                  </div>
                  {drawn.hasBuds && (
                    <div>
                      <span style={{ color: C.onDim }}>F → </span>FF
                    </div>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setStrokes(new Set());
                      setBuds(new Set());
                    }}
                    disabled={strokes.size === 0 && buds.size === 0}
                    className="flex-1 py-1.5 text-xs rounded-sm"
                    style={{
                      border: `1px solid ${C.plateGlow}`,
                      color: strokes.size || buds.size ? C.faded : C.dim,
                      background: "transparent",
                      opacity: strokes.size || buds.size ? 1 : 0.5,
                    }}
                  >
                    Clear the tray
                  </button>
                  <button
                    onClick={refineAsText}
                    disabled={!drawn.rule}
                    className="flex-1 py-1.5 text-xs rounded-sm"
                    style={{
                      border: `1px solid ${C.plateGlow}`,
                      color: drawn.rule ? C.faded : C.dim,
                      background: "transparent",
                      opacity: drawn.rule ? 1 : 0.5,
                    }}
                    title="Carry this rule into the grammar editor for hand-tuning"
                  >
                    Refine as text →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ——— the grammar editor, below the plate (preset mode) ——— */}
          {mode === "l" && (
            <div style={{ maxWidth: 460, margin: "18px auto 0" }}>
              <button
                onClick={() => setShowGrammar((v) => !v)}
                className="text-xs tracking-widest uppercase"
                style={{ color: C.dim, letterSpacing: "0.25em" }}
                aria-expanded={showGrammar}
              >
                {showGrammar ? "− the grammar" : "+ the grammar"}
              </button>

              {showGrammar && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs block mb-1" style={{ color: C.faded }} htmlFor="axiom">
                      Axiom — the seed
                    </label>
                    <input
                      id="axiom"
                      value={draftAxiom}
                      onChange={(e) => setDraftAxiom(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm rounded-sm"
                      style={{ background: C.plate, border: `1px solid ${C.plateGlow}`, color: C.onInk }}
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: C.faded }} htmlFor="rules">
                      Rules — one per line
                    </label>
                    <textarea
                      id="rules"
                      value={draftRules}
                      onChange={(e) => setDraftRules(e.target.value)}
                      rows={3}
                      className="w-full px-2 py-1.5 text-sm rounded-sm resize-y"
                      style={{ background: C.plate, border: `1px solid ${C.plateGlow}`, color: C.onInk }}
                      spellCheck={false}
                    />
                  </div>
                  <button
                    onClick={applyGrammar}
                    className="w-full py-2 text-sm rounded-sm"
                    style={{ background: C.ink, color: C.page, border: `1px solid ${C.ink}` }}
                  >
                    Sow this grammar
                  </button>
                  <div className="text-xs leading-relaxed" style={{ color: C.dim }}>
                    <span style={{ color: C.faded }}>F</span> step forward, drawing ·{" "}
                    <span style={{ color: C.faded }}>+ / −</span> turn by the branching angle ·{" "}
                    <span style={{ color: C.faded }}>[</span> remember this spot ·{" "}
                    <span style={{ color: C.faded }}>]</span> return to it · any other letter
                    is silent scaffolding, rewritten each generation.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="mt-10 text-xs" style={{ color: C.dim }}>
          After Anna Atkins (1843) &amp; Aristid Lindenmayer (1968). Every specimen here is a
          sentence that kept talking — and one of them is in your own hand.
        </footer>
      </div>
    </div>
  );
}
