# Hortus Grammaticus

*A cyanotype herbarium of rewriting systems. White specimens pressed on
Prussian blue, after Anna Atkins (1843) & Aristid Lindenmayer (1968).*

Another in the small family of daft instruments. Choose a specimen — a fern, a
tree, drifting weed — and bend its **grammar** until it becomes something else.
Or open the **seminarium**: a seed bed of graph paper where you draw the first
generation *by hand*, and the grammar writes itself, growing your gesture into
a whole plant. There is a counting flower, too, that keeps φ.

For delight only. Not a business.

---

## The three ways to grow a plant

- **A grammar** — an axiom and a handful of rewriting rules (Lindenmayer's
  L-systems). `F` steps forward drawing; `+`/`−` turn by the branching angle;
  `[` and `]` remember a spot and return to it. Every generation rewrites each
  symbol as the whole rule, so a sentence keeps talking until it is a fern.
- **The seminarium (drawn by hand)** — ink edges on the graph paper. The
  largest connected drawing is the plant, its lowest stroke the root; a
  depth-first walk transcribes your gesture into turtle speech, and that
  becomes the rule the plant grows by. Carry it into the grammar editor to
  hand-tune it.
- **Phyllotaxis** — florets placed one golden angle apart, `θ = n · 137.508°`,
  `r = c√n`. A twentieth of a degree is the whole difference between spokes and
  a sunflower.

---

## Running it

```
npm install
npm run dev      # local, at the printed URL
npm run build    # production bundle in dist/
```

Built on **Vite + React**, the way the whole family is, so it ships the family
way: GitHub → Vercel (rebuilds on every push) → a stable URL → embedded in
WordPress via one iframe. Tailwind provides the layout utilities; the rest is
plain SVG and one canvas.

---

*One of a family that also holds Mooring, the Persicaria Portal, and
Berm-Ester. Every specimen here is a sentence that kept talking — and one of
them is in your own hand.*
