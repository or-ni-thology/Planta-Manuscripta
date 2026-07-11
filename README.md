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

## Embedding it in WordPress (no double scrollbar)

An iframe can't guess how tall the toy has grown, so it picks a height, the toy
overflows it, and you get a second scrollbar riding beside the page's own. The
toy fixes its half automatically: on every change it tells its parent page how
tall it is (a `postMessage` of `{ type: "planta:height", height }`). All the
parent has to do is listen and resize the frame to match. Paste this once into
the page or a Custom HTML block — set `src` to your Vercel URL:

```html
<iframe id="planta" src="https://YOUR-APP.vercel.app/"
        style="width:100%;border:0;display:block" scrolling="no"></iframe>
<script>
  addEventListener("message", function (e) {
    if (e.data && e.data.type === "planta:height") {
      document.getElementById("planta").style.height = e.data.height + "px";
    }
  });
</script>
```

The `scrolling="no"` and the height-to-fit are what banish the inner bar; the
message keeps the frame the right size as the plate and the seed bed grow.

## Taking a plate away

Under each plate the drawer offers two ways to press it: **png** (a pixel
arboretum for the phone) and **svg** — the same specimen as vector line and
leaf, so it scales to any title or header without going soft. The SVG isn't a
screenshot of the canvas; it replays the very geometry the plate was drawn from
— every segment, leaf and floret — so a tree stays a tree all the way down.

---

*One of a family that also holds Mooring, the Persicaria Portal, and
Berm-Ester. Every specimen here is a sentence that kept talking — and one of
them is in your own hand.*
