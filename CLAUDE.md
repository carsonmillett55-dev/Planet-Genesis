# Planet Genesis — working notes

A LittleBigPlanet-style creative sandbox: paint materials into a world, they
become real physics bodies, then play in it. One self-contained HTML file,
Matter.js for physics, everything else hand-written.

**Read this before changing anything.** Most of what follows was learned the
hard way, and several of the invariants look arbitrary until you break one.

---

## Layout, and why it is flat

Every file sits at the repo root. That is deliberate, not neglect: the test
suites resolve `preview.html` next to themselves, and `mkprev.py` reads
`planet-genesis.html` from the working directory. Splitting into `src/` and
`tests/` is a fine idea, but it is a change to a working system and should be
done on purpose, with the suites re-run, not as a drive-by tidy.

| file | what it is |
| --- | --- |
| `planet-genesis.html` | **The game.** ~408KB, the source of truth, what gets published. |
| `geom.js` | The polygon geometry core. Also inlined verbatim inside the HTML — see the hazard below. |
| `pc.min.js`, `earcut.min.js`, `matter.min.js` | Vendored libraries, kept for the test harness and for re-inlining. |
| `mkprev.py` | Builds `preview.html`: swaps the Matter CDN for the local copy, strips web fonts, appends the `window.__pg` test hook. |
| `regress.js` `tsel.js` `tlayer.js` `tmat.js` `tlight.js` `tctx.js` `tpop.js` | Playwright suites, 130 checks between them. |
| `tenv.js` | Finds the machine's Chrome and resolves `preview.html`. Every suite goes through it. |
| `checkgeom.js` | Verifies `geom.js` still matches the copy inlined in the HTML. |
| `level.json` | Carson's real level. The perf runs measure against this, not a synthetic one. |
| `teardown.html` | An architecture teardown of the project, written earlier. Predates the polygon rewrite — its "leave it alone" section describes the old dab model. |
| `ROADMAP.md` | Carson's direction for the whole project. The goal all the work aims at. |

### Running the tests

Once, to install the driver:

```
npm install               # playwright-core only — no browser download
```

Then:

```
python mkprev.py           # regenerate preview.html after ANY edit to the HTML
npm test                   # all 130 checks + checkgeom, in order
npm run perf               # migration and frame time on level.json
```

Or one suite at a time:

```
node regress.js            # 31 — geometry, save/load, play mode, loop and save safety
node tsel.js               # 22 — selection, marquee, group transforms
node tlayer.js             # 9  — layer accuracy and ranked picking
node tmat.js               # 16 — materials, colours, glass, light
node tlight.js             # 20 — lighting, shadows, glow
node tctx.js               # 13 — the right-click popit menu's lifetime
node tpop.js               # 19 — the popit's bags, pages and gradient
node checkgeom.js          # geom.js vs the inlined copy
```

The suites run against `file://preview.html` in whatever Chrome or Chromium
the machine already has. `tenv.js` finds it — the search order covers the
Playwright Chromium on Linux, Chrome and Edge on Windows, and Chrome on
macOS — so no suite hardcodes a path any more. Set `PG_CHROME` to override.

`playwright-core` rather than `playwright` on purpose: it drives a browser
you already have instead of downloading a private 130MB copy.

**Tests that paint into a dynamic object must aim at where it *is*, not
where it was painted.** Build mode runs physics, so anything not static has
already fallen by the next drag. `tmat.js` reads the body position first;
copy that pattern rather than a fixed offset, or the test passes only on a
machine slow enough to hide the fall.

**`preview.html` is generated and gitignored.** All test hooks live in
`mkprev.py`, never appended ad hoc — and `window.__pg` must never reach
`planet-genesis.html`. Publishing a build with the hook in it would expose the
whole editor's internals to anyone who opens the page.

---

## The geometry core

Every painted shape is a real polygon, the way LBP stores material: a flat
list of corners split into loops, with painting, erasing and cutting as
boolean union and difference. Not a pile of overlapping circles — that is what
this replaced, and it is why carves are clean and zoomed-in framerates are flat.

Built on `polygon-clipping` (exact arithmetic, robust) and `earcut`
(triangulation with holes), **both inlined** into the HTML. The editor's core
operations must not depend on a CDN being reachable.

### Types

```
Ring       [[x,y], ...]          implicitly closed, no repeated last point
Poly       [outer, hole, ...]
MultiPoly  [Poly, ...]           each Poly is one CONNECTED piece
```

### The winding convention — outer positive, holes negative

Enforced by `pgClean`, relied on everywhere. It buys two things at once:
canvas `fill()` (nonzero) handles holes for free, and it is exactly the vertex
order Matter.js wants (verified against `Bodies.rectangle`). Reverse a ring
and you get an invisible shape with inside-out collision.

### The CSG material rule — LBP's own

Painting material A **unions into A's region and subtracts from every other
region.** This is not an approximation of LBP, it is what LBP does: its
`RMaterial` carries an explicit `disableCSG` flag, which only exists because
CSG is the default. Painting over another material in the same plane carves it
and auto-glues.

Consequence worth remembering: same base material, different tint, is a
*different* region — `"wood"` and `"wood:16"` carve each other. That is
intended and matches LBP.

### Other geometry facts

- **Swept brush.** Dragging a convex brush covers the Minkowski sum with the
  drag, which is the convex hull of the brush at both endpoints. Circles use a
  directly-built capsule instead. `sweepRing` walks the far arc from `a0`
  *decreasing* by π so it passes through the direction of travel — go the
  other way and you get a bowtie. `circleRing` forces an even segment count so
  the capsule's two half-arcs meet.
- **Physics decomposition.** earcut triangulation (holes handled natively) then
  Hertel–Mehlhorn merge into convex parts. `MAX_PART_VERTS = 24`.
- **`pgUnionMany` is a balanced chunked reduction**, not one big union call.
  One call goes quadratic: 1,200 circles took 6.2s, the reduction does it in
  262ms, because each sweep stays small and interior corners are discarded at
  every level.
- **Tolerances:** `GEOM_TOL = 0.45` (live paint), `GEOM_TOL_MIG = 1.05` (v2 dab
  migration), `PHYS_TOL = 1.4`, `SHADOW_TOL = 5`.
- **Budgets:** `MAX_OBJ_CORNERS = 9000`, `MAX_LEVEL_CORNERS = 260000`,
  `MAX_PHYS_PARTS = 1400`.

---

## Matter.js facts that are easy to get wrong

- `Body.create({position, vertices})` **recentres the vertices on their area
  centroid.** So passing `ringCentroid(ring)` as the position leaves them
  exactly where you put them. Pass anything else and the shape moves.
- Compound `Body.create({parts})` sets position to the area centroid too.
- Per-part `isSensor` works for collision resolution — you do not need a
  separate body to make one region of an object pass through.
- Each rebuild **bakes the body's accumulated rotation into the stored
  polygons and resets `body.angle` to 0.** Geometry is always stored unrotated.
- `rebuildFromPieces(o, {a:0, x:0, y:0})` when the geometry you are handing it
  is already in world space — otherwise you double-apply the frame. That bug
  made flips jump.

---

## Rendering

- **The frame is split in two: `drawFrame()` draws, `render()` wraps it.**
  `requestAnimationFrame` used to be the last statement inside the frame body,
  so anything that threw skipped the reschedule and left the page a still
  image until reload. The reschedule now lives outside the try and always
  runs. **Do not move it back inside, and do not let `drawFrame` become the
  thing rAF calls.**
- The catch also **unwinds the canvas**, which matters as much as catching.
  `drawFrame` opens a `save()` and closes it at the bottom, with nested
  save/restore in between; throwing halfway leaves entries on the state stack
  and the next frame pushes more on top, so the transform drifts and every
  later frame is wrong. `restore()` on an empty stack is a defined no-op, so
  unwinding generously is free.
- Frame errors are logged three times and then go quiet. A fault that repeats
  every frame would otherwise bury the console at sixty lines a second, which
  hides the first error — the only one that says where it started.
- One `Path2D` per material region. Passes run **per region** — fill, then a
  clipped two-band bevel, then ink — so a later region covers an earlier one's
  outline. Drawing all the ink after all the fills puts a hole's outline on top
  of whatever filled it.
- **Depth is alpha plus a side-face offset. There is no geometric scale.** An
  earlier version scaled back/front layers by 0.88/1.1, which made the drawn
  shape stop matching the polygon: shapes appeared to shrink or grow on
  release and hit-testing missed them. Do not reintroduce it.
- `objectAt` ranks hits — build layer first, then layer, then draw order —
  rather than returning the first match in creation order. Without this a
  background object steals clicks from something in front of it.
- Objects rasterise to a bitmap cache and blit each frame. When an object is
  too large to cache it bakes *softer*, it does not fall back to redrawing
  paths every frame — that cost 8ms on one of Carson's back-layer objects.

## Lighting

- Half-resolution buffer (`LR = 0.5`), per-light scratch canvas sized to the
  light, not to the screen. Both of those were performance fixes worth ~20ms.
- `destination-out` burns the hole, `lighter` casts the colour. The gradient is
  drawn in the light's **own colour** so alpha burns and colour fills in one
  pass; recolouring the whole canvas with `source-in` afterwards cost 13ms.
- Lights are culled by reach, and the scratch clear is tightened to the used
  region — clearing the whole scratch per light was most of a frame.
- Shadows are quads projected from back-facing edges. The interior normal of a
  positively wound ring is `(-dy, dx)`. Each quad's winding is normalised, or
  overlapping quads cancel under nonzero fill.
- Glow range is 10%–1200% (`GLOW_MIN = 0.1`, `GLOW_MAX = 12`), radius is
  `L.r + 100 * glow` — **linear**, not squared.

## The popit menu

`ctxObj` tracks which object the open menu belongs to and `ctxCam` snapshots
the camera at open time. `pruneObjCtxMenu()` runs every frame and closes the
menu when its object is gone or the camera has moved more than 6px. It is a
catch-all on purpose: no future way of deleting an object or moving the camera
has to remember the menu exists.

---

## The physics step

All eight physics handlers register through **`onStep()`**, never
`Events.on(engine, ...)` directly. Add a new one the same way.

A throw inside a handler aborts the whole step, and the runner keeps calling
it — so the world stops moving while the page burns CPU throwing over a
hundred times a second. That was measured, not assumed: breaking one object
froze every other object solid and threw 145 times in 1.2 seconds. Worse than
a clean stop, because it looks like a hang rather than a crash.

`onStep()` catches, so a failing handler loses only its own work for that one
step; the other handlers and the physics itself carry on. Errors log three
times and then go quiet, same as the frame loop.

## The popit

Modelled on LBP2's, which is bags across the top and pages inside each bag —
not a list of tabs down the side. `PM_BAGS_BUILD` is the whole structure:

- **Popit Cursor** — an action, not a page. In LBP it is a tool you pick up
  and use on the level, so picking it selects the move tool and closes the
  menu.
- **Goodies** — what you build the world from. Materials, My Objects. LBP2
  also has Objects, Community Objects and Hearted.
- **Tools** — what you build behaviour from. Functions today; LBP2 also has
  Gadgets, Gameplay Kits, Music, Sound Objects, Backgrounds and the rest,
  which is where the roadmap's gadget family and music tab land.
- **Global** — the level itself.
- **Costume** — Character, and Your Popit.

Adding a page is one line in that table. A bag with a single page hides the
page row, since the bag icon already said what it is.

**The gradient is a personal setting, not a level one.** Two colours and an
angle, written onto `#personalMenu` as `--pop-a`, `--pop-b` and `--pop-ang`,
so the stylesheet keeps ownership of how they are used and the JavaScript
never has to know the layout. Saved in `pg_popit` in localStorage next to the
character, never in the save file — your popit follows you between levels.

`renderInfoTab` is still defined but no longer reachable: LBP2 has no Info
bag, and the plan is a tutorial mode instead. `MATERIAL_INFO` is its content
and is kept for that.

## Selection, and what Del means

Clicking with the Move tool records **which piece** you clicked, in
`selectedRegion`. Del acts on that piece, not the whole object — draw a bar of
sponge through a wooden circle, click the sponge, press Del, and the circle
stays. Before this, Del took the object and cutting was the only way to remove
one piece.

The whole object is one gesture away: **double-click**, or rubber-band it.
Both leave `selectedRegion` null, and every path that acts on a selection
already falls back to the whole object when no region is held — so the
double-click handler only has to clear the region, and anything added later
inherits the behaviour without knowing about it.

`regionIsWhole()` keeps a one-material object behaving as it always did, since
there the piece and the object are the same thing.

## Saving

`doSave()` used to call `.add()` every time, so each press wrote a whole new
~165KB document and the level list filled with copies of one level.

The session now holds **two ids** — `cloudLevelId` and `localLevelId` — and a
save updates the document it wrote last time. Two rather than one because the
cloud and the device are separate stores and a failed cloud save falls back to
the device: that is a fallback *copy*, not a change of identity, so the next
save must still try the cloud.

The ids are persisted in `pg_level_id` next to the autosave. Without that, a
reload would forget which document it was editing and the next save would fork
a copy — which is most of the original bug back.

Anything that changes which level is open must set them: loading a row sets
one and clears the other, `doNew()` clears both, and deleting the open level
clears whichever matched. `regress.js` covers all four paths.

## Known hazards

- 🔴 **`geom.js` is duplicated.** The standalone file and the copy inlined in
  the HTML are kept in sync by hand. `node checkgeom.js` catches drift; a real
  build step would retire the problem. Until then, edit one and copy it over.
- 🟠 **Autosave writes ~140KB synchronously every 15 seconds.**
- 🟠 Levels have no owner or thumbnail. They *do* now have an id — see
  **Saving** — but nothing ties one to a person.
- 🟠 Characters and My Objects are localStorage-only.
- 🟠 408KB in one file is at the edge of comfortable.

## What's next

**[`ROADMAP.md`](ROADMAP.md) is the full picture** — Carson's direction for the
whole project, captured 2026-09-10 and sorted by what each part depends on.
Read it before planning anything larger than a bug fix.

The short version. Near-term, cheap and self-contained: the bolt rework,
region-delete (Delete should remove the selected material region, not the whole
object), the fill tool, a 4x larger world, and the water/ice polish. Then the
LBP gadget family — buttons, levers, player and water sensors, emitters, mover,
world changer, creature eye — none of which exists yet, and which is the
biggest jump in what a level can actually do.

Also still wanted from the earlier list: custom drawn materials (the save
schema already reserves `u:<id>` keys — needs a drawing surface, property
sliders, naming, and embedding into levels), layer peek, and sprint on shift.

The floppy swingable rope is **superseded**: the player mechanic is an
LBP-style grab, designed for keyboard and mouse rather than a held shoulder
button. Ropes as level objects are unaffected.

Beyond that the project grows a hub world, several more creation surfaces
(creatures, music, backgrounds, particles, a rollercoaster, a 2.5D mode), and
an online platform with levels, friends, multiplayer, currency and a store.
That last part needs a backend that does not exist; `ROADMAP.md` says what has
to be decided before it is built.

## How Carson works

He is the creative director. He directs the design; the code, and the
engineering judgement behind it, are mine.

**Standing authority: fix what is broken, unstable, or a threat to the
project without asking first.** Keeping it stable is the job, not a favour to
ask permission for. Design decisions are still his.

He wants a senior developer, not an order-taker: **push back before
implementing something that creates technical debt.** Slow and solid beats
fast and fragile. Preserve working systems, and don't rewrite things for
cleanliness. The target is LBP's actual behaviour — when in doubt, research
what LBP really did rather than approximating it.

**Write to him in plain language.** He does not read code and does not want
jargon; explaining in engineering terms wastes his time. Say what changed and
what it means for the game. Keep the technical detail in this file and in
commit messages, where it belongs.

"We have all the time in the world."
