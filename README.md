# Planet Genesis

A LittleBigPlanet-style creative sandbox that runs in one HTML file. Paint
materials into the world with a brush or drag-out shapes, and they become real
physics bodies you can immediately play in — walk on, knock over, grab and swing from.

Materials behave the way LBP's do. Painting one material over another carves
it and glues the result; deleting something nested inside another material
leaves a clean hole; right-click cuts the brush's own shape out of whatever is
under it. Everything is real polygon geometry — boolean unions and differences
on closed contours — so a carve is exact rather than an approximation, and
zooming in doesn't cost framerate.

There are three depth layers, 28 material colours, glass, emissive light
materials with real shadow casting, and a full save/load format.

## Running it

Open `planet-genesis.html` in a browser. That's the whole thing — the geometry
core is inlined, and the only external dependency is Matter.js from a CDN.

## Working on it

Read [`CLAUDE.md`](CLAUDE.md) first. It carries the architecture invariants —
the polygon winding convention, the CSG material rule, the Matter.js
behaviours that are easy to get wrong, and the list of known hazards. Several
of them look arbitrary until you break one.

Tests are Playwright suites, 768 checks across twenty files:

```
npm install           # once — playwright-core, no browser download
python mkprev.py      # regenerate the test build after editing the HTML
npm test              # all 768 checks
npm run perf          # migration + frame time on a real level
```

They run in whatever Chrome or Chromium you already have; `tenv.js` finds it,
and `PG_CHROME` overrides.

## Credits

Built by Carson with Claude. Geometry by
[polygon-clipping](https://github.com/mfogel/polygon-clipping) (MIT) and
[earcut](https://github.com/mapbox/earcut) (ISC); physics by
[Matter.js](https://brm.io/matter-js/) (MIT).
