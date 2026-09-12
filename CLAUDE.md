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
| `planet-genesis.html` | **The game.** ~900KB, the source of truth, what gets published. |
| `geom.js` | The polygon geometry core. Also inlined verbatim inside the HTML — see the hazard below. |
| `pc.min.js`, `earcut.min.js`, `matter.min.js` | Vendored libraries, kept for the test harness and for re-inlining. |
| `mkprev.py` | Builds `preview.html`: swaps the Matter CDN for the local copy, strips web fonts, appends the `window.__pg` test hook. |
| `regress.js` `tsel.js` `tlayer.js` `tmat.js` `tlight.js` `tctx.js` `tmenu.js` `tbolt.js` `tgadget.js` `tlink.js` `tgrab.js` `tjump.js` `tcam.js` `tmover.js` `tworld.js` `tcreature.js` `twater.js` `tstudio.js` `tskins.js` `tfill.js` `tfan.js` `tstickers.js` `tlogic.js` `tproj.js` `tui.js` `tgame.js` `tplayers.js` | Playwright suites, 1245 checks between them. |
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
npm test                   # all 1245 checks + checkgeom, in order
npm run perf               # migration and frame time on level.json
```

Or one suite at a time:

```
node regress.js            # 46 — geometry, save/load, play mode, loop and save safety, two tabs and the autosave, map edges, the big map and an old level's move to its bottom
node tsel.js               # 69 — selection, marquee, group transforms, resize, detach, the number row, the transforms as keys, dragging with physics on, the marquee by material; glue across layers and on one layer
node tlayer.js             # 20 — layer accuracy, ranked picking, the hover label, peek, the middle button hiding one thing
node tmat.js               # 33 — materials, colours, glass, light, opacity, a drawn material of your own
node tlight.js             # 29 — lighting, shadows, glow; the day glow, reach by size, the Spotlight's cone, wired, saved
node tctx.js               # 24 — the object box: opening, closing, moving, remembering
node tmenu.js              # 31 — the personal menu's sections, the Tools bag's four pages, the number keys, the gradient
node tbolt.js              # 57 — bolts: through the layers, four kinds, limits, the box, the ghost, moving, typed rpm, painting onto a bolted wall, save/load
node tgadget.js            # 49 — player sensor, button, lever, wires, what they drive, moving, paused walking
node tlink.js              # 60 — pistons and rope: placing, cycling, stiff, wired modes, hanging, resize, moving, save/load, the slider's field and keys
node tgrab.js              # 62 — grabbing: by key or mouse, swinging and its cap, dragging, carrying on the ring, loads, no riding, no clipping; sprint; the weight slider
node tjump.js              # 27 — the jump: no wall climbing, grace off a ledge, a press just before landing; ice is skated on; crouch under a low shelf and the slide; the double jump setting
node tmover.js             # 28 — the Mover: two-click placing (any tool takes the second click; the box can start the choosing again), once and bounce, riding it, a loose host held, wired, the knob, save/load
node tworld.js             # 22 — the Water sensor (touching, not a pool above; on Front), and the World changer's light and water, wired, latched, saved
node tcreature.js          # 32 — the Creature eye: chasing, stopping short, sight, locked, flying, the stomp, painted weak spot and danger, colour, a Back-layer creature, save/load
node twater.js             # 15 — the eraser by layer, the vacuum, water drying up and a pool staying
node tstudio.js            # 71 — the studio: strokes, undo/redo, the tools, frames, playback, no rig; the brush ring, filled shapes, nudge and flip, the Settings card's keys; the character's size and drawn hitbox
node tfill.js              # 14 — the fill: a closed outline fills with material or water; open space, material, a gap and an island
node tfan.js               # 9 — the Fan: lifts the player and a loose crate, hovers in reach, wired on/off, saved
node tstickers.js          # 15 — stickers: drawn, kept, stuck on a thing (never on nothing), riding, picked by their picture, size/turn/flip, saved
node tlogic.js             # 43 — tags and tag sensors, impact sensors, timers, counters, the reset wire, the object emitter
node tproj.js              # 42 — the launcher (bullets, shots that run out, a ray, a saved object), a drawn projectile that hurts a creature, an emitter firing bullets, the save tabs; how it flies is the firer's, the Impact drawing, an emitter firing rays, the projectile sensor's every-Nth-hit, named projectile, box, painted spots and destroy; the missile's hole, scorch and launcher
node tskins.js             # 70 — the Custom creature and Custom object wizards (size, look, hitbox, weak spot, danger), a fresh one held still with no collision until its hitbox is drawn, undo on a step, the marker in the hitbox's middle and moving the whole thing, placing in a drag-out shape mode, the old body names, death and attack animations, facing, no-collision, particles with pictures and their opacity
node tcam.js               # 92 — Play's own zoom and height, the World page's live preview, zooming on the cursor, Camera gadgets (zone box, view frame, dragging both, the honest frame, mid-air cameras, wired, three holds, glide, shake, freeze, the Build preview), walking and sprinting pace, grab reach
node tui.js                # 158 — Play from here, the minimap (a click looks, the right button goes), level pictures, the tips, the device's room, backgrounds, music, Ctrl+Z pausing, the menu holding still under a slider; My World and level doors, a level's character size; level types and their rules; a controller
node tplayers.js           # 35 — local players: a second pad joins on Start, each pad drives its own character, the keyboard the first; a sensor sees any of them; the camera on the first and a bubble for one left behind, or one who dies; back to Build together; a pad gone and its player leaving
node tgame.js              # 85 — the speech bubble, the destroyer, the sound, the gates (AND, OR, XOR, NOT, toggle), save/load; a saved object's gadgets and wires placed, emitted and fired, a drawn creature out of an emitter; the rocket, the speed cap and breaking apart, being squashed
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
- Glow range is 10%–1200% (`GLOW_MIN = 0.1`, `GLOW_MAX = 12`). **A
  light's reach grows with its size**: `lightReach(halfSize, glow)` =
  `(80 + 0.4 × half) × glow`, so a huge lamp throws a huge light (a
  1000px strip reaches 280px at glow 1, 3400 at max) and a small one
  is what it was.
- **Lights glow in every light, daylight included**, as a shape-hugging
  halo: `objectGlow(obj)` fills the light pieces and blurs them by the
  reach (`shadowBlur`, drawn twice plus a tighter pass) into a canvas
  cached on the object by `geomRev` and `glow` (capped at 1024px a side,
  scaled down past that; dropped with the bitmap), and `drawLightGlows
  (layer)` — after each `drawLayer`, before its bolts — blits it
  additively (`lighter`) in the object's frame at an alpha that rises
  as the world darkens. Before this `drawLighting` returned at once in
  daylight and a lamp was invisible except as its own colour; Carson's
  "you can't even really see the light".
- **At night the burn and the cast follow the shape.** Each light
  object is one entry (not one per ring): in the scratch, a soft
  radial throw out to the reach, and over it the same halo canvas
  turned with the body — so a strip lights a strip-shaped room —
  then the shadows cut out of that as before. The colour cast's alpha
  (`tint`) is down to `0.42 × (1 − light) + 0.06`: it adds light rather
  than painting over the scene.
- **Painting a light shows its light**: `drawStrokePreview` draws a
  light material's stroke path additively with a `shadowBlur` of its
  reach, so the colour reads mid-stroke, not only on release.
- **The Spotlight** (`kind:"spot"`, Gameplay, host required): a cone
  from its spot, `angle` degrees round from straight up in the host's
  frame (so it turns with the host, as the fan does), `cone` wide,
  `reach` long, `color` (a palette of light colours and any colour),
  `bright`; wired, while the signal is on, else always. `spotLights()`
  lists the ones that are on; `drawSpotGlows` draws each cone
  additively by day (no shadows in that pass — it is a cheap wedge);
  `drawLighting` adds them to `lights` with `cone`, clips the scratch
  to the wedge and fills a radial gradient scaled by `bright`, and the
  shadows cut it as they cut any light. The cone is outlined in Build
  while selected or with the tool in hand.

## The object box

One docked panel for everything about what you have selected — `#objPanel`,
rendered by `renderSelBar()` (the name is historical; every edit path already
called it, so it kept the name and changed its job). It replaced two things
at once: the strip that followed the selection around and sat on top of it,
and the right-click popup, which held half the same buttons.

- **Only the right button opens it.** A left-click selects — it is for
  grabbing, moving and resizing, and the box getting in the way of that on
  every click was the complaint. `opWanted` is the box's own open/closed
  state, separate from the selection: right-click sets it, the close button
  and losing the selection clear it, and while it is open it follows
  whatever is selected. Closing it keeps the selection, so you can still
  drag the thing. `openObjCtxMenu` and `closeObjCtxMenu` survive as thin
  wrappers so nothing had to be rewired.
- **The lock shows what it is, not what clicking will do.** "🔒 Locked" or
  "🔓 Unlocked", highlighted when locked. Carson asked for this specifically;
  a button that reads "Let it fall" on a locked object made you work out the
  state from the action.
- **Sections appear only when they apply** — no Light section on a plank, no
  This Piece section unless you clicked a real piece of something bigger.
  It re-renders from scratch on every change; it is small, and that is far
  simpler than keeping a dozen buttons' states in sync by hand.
- **The camera does not close it.** The old popup was pinned to a spot on
  the level and had to close on any camera move or it would point at nothing.
  The box is docked to the screen. `pruneObjCtxMenu()` still runs every
  frame as a catch-all, but now only for "the object is gone".
- **It is yours to move and resize**, by the header and the corner, and both
  are remembered in `pg_panel` next to the menu gradient. Position is saved
  and restored with `offsetLeft`/`offsetTop`, which measure from inside the
  stage's border — the same thing `style.left` positions against. Mixing in
  `getBoundingClientRect`, which measures from outside it, put the box 5px
  off every reload.
- **`clearSelection` hides the box before it bails out.** `removeObject`
  nulls `selected` and then calls it, so an early return above the hide
  left the box open with nothing in it. The guard on `objPanelEl` is for
  boot, when `clearAllObjects` runs before the element has been looked up.

**Bolts and gadgets will show their settings here too.** That is the point
of one box: a bolt's speed and tightness, a mover's line, a sensor's range
all get a section, not a popup each.

---

## Weight

Every object has a **Weight** slider in its box: a multiplier on what its
materials weigh, 1%–400%, `o.weight` (undefined = 1), saved as `weight`,
carried by duplicate, snapshots and the level file. Carson's ask: a big
thing that is easy to swing on, or to pick up even though it is big. A
note under the slider says what it comes to against the player — "3.2×
your weight — too heavy to carry" — since carrying is `CARRY_MASS_RATIO`.

`applyObjectWeight`, called at the top of `refreshObjectPhysics` so every
rebuild keeps it: the base mass is the sum over parts of area × material
density (what Matter gave the compound in the first place, computed
rather than read so it does not matter whether the body is static), and
`Body.setMass` scales it, inertia along with it. **A static body has to
be woken for the change**: `Body.setStatic` stashes the real mass in
`_original` and hands it back on freeing, so setting the mass on a static
body would be thrown away — it goes `setStatic(false)`, `setMass`,
`setStatic(true)`, which also resets `positionPrev`, harmless on
something not moving. A static body with no `_original` is left alone.

The buoyancy safety rail (2.5× own weight) scales with it, or a
feather-light block could not float.

## Custom materials

A material you drew — the roadmap's custom drawn materials, and the
"material editor" Carson asked the fill tool into. `customMats` (id →
def: `name`, `tile` — a square studio drawing — `tilePx`, `friction`,
`restitution`, `density`, `grabbable`, `hazard`, `floats`) is everything
the session knows; `myMats` is the ids on this device's palette
(`pg_my_mats`). Ids are `u_<n>` — **no colon**, so `matBase`/`matTint`
leave them alone (the save schema's old `u:<id>` reservation would not
have survived the tint parser). `matOf` falls through `MATERIALS[base]`
to `customMatRec(base)`, a record shaped like a built-in material
(`custom:true`, `id`, `tile`, `tilePx`; `color` is the tile's average,
`dark` shaded from it; `floatForce` 2.1 when it floats), so every reader
of `mat.friction`, `.hazard`, `.grabbable`, `.density` and `.floatForce`
works unchanged.

**Drawn**: `objectPaths` keeps the record on the region (`custom`) and
`paintObjectPasses` fills the region with the average colour and then
with the tile as a repeating pattern (`customMatPattern`: the tile
rasterised at 2×, a `CanvasPattern` with a `DOMMatrix` scaling it to
`tilePx` world px, cached per tile revision) — in the object's own frame,
so the tile turns with the object; the bitmap cache bakes it like any
fill. `customMatChanged(id)` drops the record and pattern, bumps
`geomRev` on every object painted with it and refreshes its physics,
so a slider on the Materials page changes what is already built.

**Made**: the Materials page's **My Materials** grid (a tile thumbnail
per material, and New) → `openMaterialDraft` opens the studio on a
`material` subject (one square `tile` state, the backdrop drawing the
eight neighbours faint, the view zoomed to 0.7 so they show); closing a
fresh one asks for a name (`finishMaterialDraft`) and registers it, on
the palette, as the brush. With one as the brush the page shows its
settings (`renderCustomMatSettings`: Edit the tile, Forget, Tile size,
Grip, Bounce, Weight, Grabbable / Deadly / Floats) instead of the colour
row (a tile has its own colours; `MATERIALS[baseId]` would be undefined
there anyway).

**Saved inside the level**: `serializeLevel` embeds `materials`
(`usedCustomMats`, the packed defs of every custom material any piece
uses) and `loadLevelData` registers them **before** the objects unpack —
`unpackObject` drops a piece whose material is unknown. Forgetting one
takes it off the palette only. My Objects is device-local like the
palette, so a saved object made of a forgotten material would lose those
pieces on a later load — a known gap.

## Opacity

Every object has an **Opacity** slider in its box (`o.alpha`, 5%–100%,
undefined = solid; saved as `alpha` only when under 1, carried by
duplicate, snapshots and the level file), and the Materials page has an
Opacity slider for **new paint** (`paintAlpha`, `pg_paint_alpha`): an
object made while it is under 100% is born at that opacity, and the
stroke preview shows it. It is drawing only — `drawObject` multiplies
the layer's fade by the object's own (`depth.a`), which is applied at
the blit, so the bitmap cache is untouched — the physics never changes.
Paint welded into an existing object takes that object's opacity; an
object has one.

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

## Bolts

A bolt pins two objects at a point and, **as in LBP, the two must be in
different layers**: it goes through the front one into the one behind. This
was researched, not assumed — the LBP wiki: "the objects must be in different
layers if you wish to link them with a bolt." Only the Mid layer has physics
here, so a bolt is a Mid thing pinned to a fixed Back or Front backdrop: a
wheel on a wall, a seesaw, a door, a spinner. Two things side by side on the
same layer cannot be bolted. `boltPairAt(x, y)` finds the object under the
point on the build layer and a partner on another layer — behind first,
then in front, then two away, so Front bolts to Back with nothing between;
the bolt takes the front-most layer of the two so it draws on top.

**The open question this leaves** is a cart with wheels — wheel bolted to
cart body, both moving — which LBP does with both parts physical in
different layers. Not possible here until Front/Back objects can be physical.
Carson's call; flagged, not decided.

Four kinds, LBP1/2's own, **each its own tool** in the Tools section and each
with its own settings in the object box. The kind can also be changed there.

| kind | what it is | settings |
| --- | --- | --- |
| **Bolt** | a pivot | tightness — rotational friction, 0 free, 1 very stiff. Not a weld. Optional angle limits. |
| **Sprung bolt** | a pivot that springs back to the angle it was placed at | strength (the spring), tightness, "set rest angle to now", optional angle limits |
| **Motor bolt** | drives what is attached round | speed, direction |
| **Wobble bolt** | swings to an angle either side of where it was placed and back | angle each way, seconds per swing, direction |

Every bolt has a **layer** and draws with it — `drawBolts(l)` runs right after
`drawLayer(l)`. `drawBoltGlyph(kind, tightness, spin, alpha)` is the one
drawing routine, shared with the **ghost**: with a bolt tool in hand the
cursor shows a translucent bolt of that kind, ringed green when there is a
pair under it and red when there is not.

Two physics-engine facts shaped the rest, both **measured, not assumed**:

- **Matter keeps a constraint's anchor offset already rotated.** It rotates
  `pointA` in place every step and remembers the angle it did that at in
  `angleA`. So the live anchor is `body.position + pointA`, full stop.
  Rotating it again — which `toWorldPoint` does — drew a bolt on a turning
  wheel at twice the angle, which read as the bolt slipping off. The joint
  itself was holding to 0.02px. `boltWorldPoint` does not rotate.
  `refreshBoltAnchors` sets `pointA` and `angleA` **together**; a rebuild
  resets the body's angle to 0 and leaving the old angle in there rotates the
  anchor by the difference on the next step. That was the flip-drifts-bolts
  bug. `carryBolts` does this after resize and flip.
- **Driving by angular velocity alone spins the body about its own centre**
  and leaves the joint to drag it round the pivot, so it sags — 63° of tilt
  under load in the probe. `driveAboutPivot` sets linear velocity too, to
  what rotation about the pivot implies (`v = ω × r`), so the integrator
  moves the body in a circle by itself and the joint only corrects gravity.
  Not `Body.rotate`: with `updateVelocity` it sets `positionPrev` to the old
  position and the Verlet step moves the body a second time.

**A rebuild keeps every bolt where it is in the world.** `rebuildFromPieces`
reads each bolt's world point off the OLD body before it goes
(`boltWorldPoint`), re-points the constraint at the new body, and
`refreshBoltAnchors(b, true)` rebuilds both offsets from that point. Before
this, only the body reference was swapped and the anchor offsets were left
as they were — measured from the old centre — so any rebuild that moved the
centroid moved every bolt by the same amount. Carson painted a big slab onto
the left of a wall of motor-bolted sponges and every sponge jumped left with
the wall's new centre: 190px in the probe. The `keepRest` flag matters: the
new body starts square with its old turn baked into the polygons, so `rest`
is moved by that turn (`-=` for the A side, `+=` for B) to keep the same
relative pose, rather than re-read as "wherever it happens to be" — a sprung
bolt mid-swing goes on springing to where it did. `carryBolts` (resize,
flip) still re-reads rest, as before.

**Angle limits** (`limit`, `minA`, `maxA`, degrees either side of rest) are a
hard stop: past the edge the free body is turned back to it about the pivot
with `Body.rotate` *without* `updateVelocity` — so `positionPrev` moves with
the body and the Verlet step does not move it a second time — and any spin
still heading out is killed. While the bolt is selected, `drawBoltLimitArc`
draws the allowed swing as a wedge about the pivot, as LBP does. A wobble
bolt draws the same wedge for its swing, in its own colour, with an arrow
for the way it sets off; a selected piston draws its reach along the rod
(`drawPistonReach`) — a band from shortest to longest, numbered ticks, and
a mark where it is now.

**A fresh motor is `BOLT_DEFAULT_SPEED = 0.02`**, about 11 rpm. New bolts do
not inherit `worldSettings.motorSpeed`; that value exists only so old levels
load at the pace they had. Speed reads in rpm in the box.

**`visible`** — every bolt has "Visible in Play". Hidden bolts still work.

Motors and wobbles run whenever the world runs — Build unpaused or Play.
Sprung bolts pull toward their rest angle each step; tightness pulls each free
body's spin toward the other's. `rest` is the relative angle at placement and
is re-read by `refreshBoltAnchors`.

A bolt is selected with a left-click (`selectedBolt`; it clears the object
selection and vice versa), right-click opens its box, Del removes it. Saves
carry `kind`, `layer`, `dir`, `tightness`, `speed`, `strength`, `angle`,
`period` and `rest`; the legacy `mode` is still written and read, so a level
saved before any of this loads as the right kind, and one without a per-bolt
speed gets the old world `motorSpeed`. The world-settings motor slider is gone.

## Gadgets and wires

The first of the LBP logic family: **player sensor**, **button**, **lever**,
and the **wires** that carry their signal. All in `gadgets[]` and `wires[]`,
and every later gadget — emitters, movers, the rest — plugs into the same
two arrays.

A gadget sits ON an object and rides with it. Position is stored two ways:
`local` is a true body-local offset (so `toWorldPoint` is right here, unlike
a bolt's Matter anchor) and `pos` is the world point, refreshed every step. A
rebuild replaces the host body with its angle reset to 0, so `local` is
re-derived from `pos` then — `reanchorGadgets`, called from
`rebuildFromPieces`. Resize and flip carry gadgets through the same map as
bolts (`carryGadgets`): same spot on the object, and for a scale the glyph
and a button's pad grow with it (`scale`, `size`). Reach is a setting, not a
size, and is left alone. Removing the host removes its gadgets and their
wires.

Each gadget has an **output**, 0 or 1:

| gadget | on when | settings |
| --- | --- | --- |
| **sensor** | the player is within `radius` (Play only) | radius |
| **camera** | takes over the Play camera while the player is in its zone, or while wired on — see The camera | zoom, tracking, speed, zone, view, hold, once, glide, shake, freeze |
| **mover** | drives its host along a line — see The Mover | line, speed, bounce |
| **watersensor** | water is touching it: a wet cell within 12px, or the world's flood above it (`waterTouching`) — not "somewhere up this column", which read a pool on a shelf above as under water | — |
| **changer** | while wired on (unwired: always; `latch`: for good once it has been), the world's light and/or water level move to its values over `secs` — see The live world | setLight, light, setWater, water, secs, latch |
| **eye** | its host is a creature — see Creatures | range, speed, fly, weak spot, danger, colour, skin, actionMode |
| **anim** | a Custom object: its own drawn body (the hitbox step) and look; Idle loops, a wire plays Action — see Drawn things | skin, hitbox, art, actionMode, ghost |
| **creature** | a Custom creature: drawn look, hitbox, weak spot and danger; chases, faces, bites, dies — see Drawn things | skin, hitbox, weakD, dangerD, art, range, speed, fly, ghost, drawnFacing, actionMode |
| **emitter** | throws out drawn particles while on (unwired: always) — see Skins | skin, rate, pspeed, angle, spread, grav, life, psize, spin |
| **fan** | blows a column of air up from itself — up in its host's frame — that lifts the player and anything loose; wired, while the signal is on, else always | width, reach, strength |
| **sticker** | a drawing stuck onto a thing or the background, riding with it — see Stickers | skin, size, rot, flipX |
| **tag** | worn by its host: a colour (and a label); wired, only while the signal is on | color, label |
| **tagsensor** | a tag of its colour within `radius`; `analog` for closeness | color, radius, analog |
| **impact** | its host hit something (a pulse) or, with `touching`, is touching it; the player only, or things wearing a tag | touching, playerOnly, requireTag, tagColor |
| **timer** | its time reached the target: counts up while on, up and down, or down from full; a reset wire | target, mode |
| **counter** | the signal's rising edges reached the target; a reset wire | target |
| **objemitter** | fires copies of a saved object — see The object emitter | emit, freq, life, maxAlive, maxTotal, speed, angle, spin, pulse |
| **gun** | the launcher powerup: touch it and you are armed — bullets, a drawn projectile, a saved object, or a ray — see Projectiles | mode, ammo (def), emit, speed, rate, ammo_n |
| **projsensor** | a projectile or a ray hit its host (a pulse) | — |
| **speech** | says its line above its host while the player is within `radius`, or wired, while the signal is on — see The gameplay gadgets | text, radius, once |
| **destroyer** | wired: the moment the signal comes on, its host is gone (Play only) | explode, blast |
| **sound** | wired: plays a level sound when the signal comes on, again every `every` seconds while on | sound, pitch, volume, every |
| **gate** | AND / OR / XOR / NOT of the wires into it, or a toggle — see The gameplay gadgets | mode |
| **button** | the player stands on it — feet at the pad's height in the host's frame, within its width | sticky (stays on once pressed), width |
| **lever** | flipped with the interact key (`F`, rebindable) while within 80px | springs back (on only while held), starts on/off |

Gadgets work whenever the world is running — Play, or Build unpaused. A
small key-cap and "use" floats above a lever in reach (`drawUsePrompt`),
naming whatever interact is actually bound to.

A **wire** is `{from: gadget id, to: bolt or gadget id}`. Every step, after
outputs are computed, each receiver's `input` is reset to `null` and then set
to the strongest signal wired into it. **`null` means unwired**, and an
unwired receiver behaves as it always did — that is the whole compatibility
story. The gadget step is registered before the bolt step so the inputs are
fresh when bolts read them.

What takes an input today (`canReceive`): a **camera** (see The camera); a **mover** (moves while the signal is on); a **world changer** (see The live world); a **motor bolt** — the signal is
the throttle, and off holds firm like a tight bolt (zeroing the velocity
alone let gravity creep the arm 3.5° in half a second, so the stop angle is
held and turned back to); a **wobble bolt** — wired, it is a *flipper*:
swings out while the signal is on, back when it drops, at the pace its
period implies. Pistons are next.

Wiring is done from the gadget's box: **Connect to…** then click the thing
it should drive; Esc or a right-click cancels. Wires draw in Build only, as
LBP's do, lit green while carrying a signal. Gadgets draw with their layer
after bolts; a sensor's reach shows while it is selected or a gadget tool is
in hand.

Snapshots (undo, mode switch) and level saves both carry gadgets and wires,
by index. Entering Play resets buttons and held levers.

## The logic family, LBP2's

Researched against LBP2's own tweak menus, built to the same shape:

- **Tag** — a colour from `TAG_COLORS` (LBP's eight) and a label, worn
  by its host. Wired, it is worn only while the signal is on (`out`).
- **Tag sensor** — `out` 1 while any active tag of its colour is within
  `radius` of it; with `analog`, closeness instead — full beside the tag,
  nothing at the edge — LBP2's "signal strength: closeness". Computed in
  a second pass after every tag's output, so it reads the tags as they
  are this step.
- **Impact sensor** — listens to the engine's own pairs for its host
  (`impactOther`: a Start is the hit, an Active the touch; never a
  sensor, never the host itself): a 160ms pulse on a hit, or on for as
  long as something is against it (`touching`, LBP's "include
  touching"); `playerOnly`; `requireTag` + `tagColor` for things wearing
  an active tag. `groundContacts` and this share the pair events.
- **Timer** — `time` runs toward `target`: `up` while the signal is on
  (holds off), `updown` (LBP's forwards/backwards), or `down` from full.
  Output at the target (zero, counting down); `level` is 0–1 for anyone
  who wants the analogue. Not `pos` — that is every gadget's world spot.
- **Counter** — counts the signal's rising edges to `target`, on from
  then until reset.

**The reset wire.** Timers and counters have a second port:
`wires[].port === "reset"` feeds `inputReset` instead of `input`
(`addWire(from, to, port)`, `hasResetPort`). It is made the other way
round — the timer's box says "Reset from…" (`wiring = { to: g, port }`)
and the next click on a switch, sensor, button, lever, timer or counter
(`gadgetHasOutput`) closes it — and draws purple. Saved as `port` in the
level file and in snapshots.

**A wired receiver never reads as unwired.** `null` input means "nothing
is wired to you"; `addWire` sets the port to 0 at once and
`resetGadgetsForPlay` sets every wired port to 0, because the first step
of Play ran before the first wire pass and an emitter wired to a lever
that was off fired once as though unwired.

## The gameplay gadgets: speech, destroyer, sound, gates

Four more of LBP's, on the same two arrays:

- **Speech bubble** (`kind:"speech"`, Gameplay) — LBP's magic mouth,
  without the name. `text` (240 chars, a textarea in the box that stops
  its keys reaching the game), `radius`, `once`. Each step: wanted =
  the signal if wired, else the player within reach; on the rising
  edge, `once` and already `said` suppresses it (`suppressed`) until
  the next rise; `showing` is wanted and not suppressed. `drawSpeech`,
  after the use prompt: the line wrapped to 230 screen px, in a rounded
  bubble at screen size whatever the zoom (`1/camScale`), a tail down to
  the gadget's spot, while the world runs. `resetGadgetsForPlay` clears
  `said`, so "the first time only" is per Play.
- **Destroyer** (`kind:"destroyer"`, Gameplay) — wired only; on the
  signal's rising edge, **in Play**, `destroyHost`: a puff sized to the
  host, and if `explode` a shove to every loose Mid body and the player
  within `blast` px of the host's edge (14 px/step at the edge, fading
  with distance, a little upward), a shake and a zap; then
  `removeObject(host)`, which takes every gadget on it, the destroyer
  included. Requests are collected in the gadget loop and run after it
  (`toDestroy`), since removing pulls the array from under the loop.
  Build never destroys anything: the snapshot brings it back anyway,
  and Build unpaused would take it for real.
- **Sound** (`kind:"sound"`, Gameplay) — `LEVEL_SOUNDS`, sixteen level
  sounds on the game's own little synth (`tone`, `noiseHit`), each
  `play(pitch, volume)`; `LEVEL_SOUND_ORDER` for the box's row of
  buttons, which play as they are picked, and "Try it". Plays on the
  rising edge, and again every `every` seconds while on (`lastAt`).
  `lastLevelSound` is what the suite reads; audio off still records it.
- **Gate** (`kind:"gate"`, Logic) — LBP2's gates as one gadget with a
  `mode`: `and` (every wire in on, and at least one), `or`, `xor`
  (exactly one), `not` (none — unwired, always on), `toggle` (`state`
  flips on the signal's rise). The wire pass counts, for a gate, `inN`
  wires into its "in" port and `inOn` of them carrying a signal, beside
  the usual strongest-signal `input`; the gate reads last step's counts,
  so a chain of gates is a step per gate, as LBP's is. A gate has an
  output and takes wires, so it sits between switches and anything.

All four `canReceive`; speech, destroyer and sound have no output
(`gadgetHasOutput`). Packed in both builders as `text`, `once`,
`explode`, `blast`, `sound`, `pitch`, `volume`, `every`, and `mode`;
`addGadget` clamps and defaults every one, so a bad `sound` is the
chime and a bad `mode` is AND. Tips for each. `tgame.js`.

## A saved object is the thing and its logic

LBP saves an object with everything on it; so does My Objects now. A
record is `{ id, name, pieces, gadgets, wires }` (`buildSavedObject`,
the tail of `saveObjectToMyObjects`): the pieces by material centred on
the group's centroid `c` as before, and `packGroupGadgets(group, c)` —
every gadget on an object in the group as its level snapshot
(`packGadgetSnap`, the one packer both the level file and snapshots now
use), with `o` dropped and its spot, painted areas and art box taken
to the world off the host and moved by `-c`, so they are in the saved
object's own unturned frame; the wires among those gadgets by index,
and a wire to anything outside the group dropped. `attachSavedGadgets
(saved, obj, frame)` is the other way: the gadgets put onto an object
just made from the record at `frame` (`{a, x, y}`, the spawn's), every
spot, area and art box turned by `a` and taken into the new body's
frame (`maskToLocal`, `toBodyLocal`), then the wires, then one
`refreshObjectPhysics` so a ghost or a drawn creature's inertia is
applied. Three callers: `stampObject` (placing from My Objects),
`emitObjectFrom` (an object emitter — a drawn creature comes out a
creature, chasing) and the launcher's object mode. An emitter's or a
launcher's capture (`captureSavedObject` → `normalizeEmit`) carries
`gadgets` and `wires` beside `pieces`, and `packEmit` writes them to
the level file, so a level fires whole things without My Objects. The
My Objects row shows ⚙ on a record that carries logic.

**Snapshots leave out what an emitter fired**, as the level file does:
`snapshotFull` skips `o.emitted` objects and the gadgets riding them,
and both builders index wires against the gadget list they actually
wrote (`liveGadgets`) — before this a Play entered from a running
Build kept every emitted copy for good, and a level saved while
running could cross its wires.

## The object emitter

LBP's emitter — Carson: "emitters which can launch your saved objects
… one of my favourite and most important features". `kind:"objemitter"`
on the Gameplay page. It **captures** the object into itself: the box
lists My Objects and picking one copies its packed pieces into
`g.emit = { name, pieces }`, so a level carries what its emitters fire
(`usedCustomMats` scans emitters' pieces too). Each `freq` seconds,
while on (unwired: always the world runs; wired: the signal; `pulse`:
one per rising edge), `emitObjectFrom` spawns the pieces at the
emitter's spot in the host's frame, flings it at `speed` in `angle`'s
direction (0 up, as the particles have it), spins it, and marks it
`o.emitted = { by, at }`. No more than `maxAlive` at once, `maxTotal` in
all; each lives `life` seconds (0: for good) and puffs away. **What it
fired is not the level**: `serializeLevel` leaves emitted objects (and
gadgets riding them) out, entering Play's snapshot never sees them, and
pausing Build takes them all back (`clearEmitted`). A guide in Build
shows the first second of flight.

## Projectiles, the launcher, the projectile sensor

**A projectile** is a drawn thing that flies (`normalizeProjDef`): a
look (`skin`, one Idle state — drawn nose to the right), a drawn
`hitbox`, an `art` size, and how it flies — `speed`, `grav` (0 none to 1
all of gravity), `life` seconds, `breaks` on the first thing it hits,
`hurts` creatures it hits. `BULLET_DEF` is the built-in one; My
Projectiles (`mySkins.projectile`, drawn in the studio from Build → My
Projectiles → Draw a new projectile, the `projectile` subject: Size and
how-it-flies first, then the look, then the hitbox; `finishProjectileDraft`
names and keeps it) are the drawn ones. A launcher or an object emitter
**captures** one (`ammoDef`, saved as `ammo`), so a level carries what
is fired.

**In flight** (`spawnProjectile`): an object of `drawnbody` with an
`anim` gadget drawn from the definition, shaped by its hitbox
(`applyDrawnSteps`), `frictionAir` 0, infinite inertia, turned to its
velocity every step so it flies nose first, part of gravity cancelled
by force each step (`grav`), `o.projectile = { born, life, grav, breaks,
hurts, owner, ownerObj }` and `o.emitted` so it is never the level. A
`collisionStart` pair with a solid → `projectileHit`: never the player
who fired it, never another projectile, not the thing it was fired
from in its first 250ms; then `hit` (gone next step, if it breaks),
`creaturePop` on a creature or eye's host in Play (if it hurts), and a
160ms pulse on every **projectile sensor** on what it hit.

**The launcher** (`kind:"gun"`, Gameplay, no host — it floats where it
is put): LBP's powerup. In Play, touching it (`armPlayer`) arms you:
`playerGun` = its mode (bullet / custom — a drawn projectile / object —
saved pieces, like an emitter's / ray), speed, `rate` shots a second,
`ammo` shots (0: no end). The Play cursor becomes a crosshair with the
line of the shot; the left button fires (`gunFire`) from just past the
player's edge toward the cursor, held to keep firing at the rate.
**A ray** is instant: `Query.ray` to the first solid, the beam walked to
its edge by bisection with `Query.point`, a creature there popped, a
projectile sensor there pulsed, a beam drawn for 140ms (`gunBeams`).
Player-fired projectiles share `CARRY_GROUP`, so they never hit the
player. `drawGunHud` names the ammo and counts the shots. Entering
Play disarms.

**How a projectile flies is a setting of what fires it.** The studio's
projectile draft is a look, an **Impact** drawing and a hitbox — nothing
about speed or trajectory (Carson: "custom projectiles should not have
settings relating to trajectory"). The launcher and the object emitter
carry `pgrav`, `plife`, `pbreaks`, `phurts` (`readFlight` on load,
`flightOf` when firing, `renderFlightRows` in both boxes under "How it
flies", `PROJ_DEFAULTS` the defaults) and hand them to
`spawnProjectile` as `opts`, which win over the definition's old
fields; a definition still carries those so a file from before loads.
`o.projectile` keeps `name` and `def`.

**The Impact drawing** (`SKIN_STATES.projectile` gains `impact`): when
a breaking projectile hits, `spawnImpact` pushes a sprite of the
impact frames — `frames` on the sprite instead of an emitter's `g`,
which `stepSprites`/`drawSprites` allow — the projectile's size ×1.3,
turned the way it flew, at least 24 frames long so it is never a
blink, fading only at the end (`noFade`). `impactsSeen` counts them.

**The emitter chooses what kind of thing it fires** — `fireKind`:
`object`, `bullet`, `projectile` or `ray` — as a row of buttons at the
top of its box, the list below filtered to that kind (Carson's "a
little circle at the top where you choose what is being emitted").
`ray`: `objEmitterStep` fires `fireRay` from the emitter's mouth
(walked out of its host) along its aim, `reach` long. `fireRay(from,
ang, maxLen, skip)` is the one ray for the launcher and the emitter:
`Query.ray` to the first solid `skip` does not rule out, bisected to
its edge, a creature popped, a projectile sensor hit at the point (and
any sensor whose box the beam crosses, `rayCrossesZone`), a beam kept
in `gunBeams`.

**The projectile sensor, grown** (Carson's list): `hits` — fires on
every Nth hit (`count`, `fires`); `only` — a named projectile
(`Bullet`, `Ray`, or a drawn one's name) or any; where a hit counts —
anywhere on the host, in a box round it (`useZone`, `zone` `{dx, dy,
w, h}` in world axes about its spot, drawn in Build while selected or
the tool is in hand; any projectile inside it counts once,
`pj.zoned[g.id]`, checked each gadget step), or on painted spots
(`useSpots`, `weak` — painted with the creature's own mask tools,
`beginMaskPaint(g, "weak")`, drawn as red targets, carried through
rebuilds, resize and flip with the creature's areas); and `destroy` —
the firing hit takes the host with it in Play (`destroyHost` with a
small bang). `projSensorHit(g, name, at, dir)` is the one gate: the
name, then the spots — the hit point sits on the surface, where a
painted edge is a coin toss, so it also looks 4 and 8px in along the
shot — then the count. `resetGadgetsForPlay` clears `count` and
`fires`.

**An object emitter can fire projectiles** (`ammoDef` instead of
`emit`): spawned from the emitter's spot walked out of its host along
the line of fire (`Query.point`) and a half-size further, `ownerObj`
the host, so a bullet is not born inside the pedestal it sits on.

## The missile

`MISSILE_DEF`, a built-in projectile beside the bullet (`missile:
true`, `blast` 44): a grey rocket with a red nose, its own Impact
frames, a wedge hitbox. The launcher's `mode: "missile"` and the
emitter's bullet kind (Bullet / Missile buttons) fire it; a projectile
sensor can ask for it by name. On a breaking hit `missileBang`: sparks,
smoke, a shake, a shove to every loose Mid body and the player within
three blasts, and — **in Play only** — what it hit: the piece under
the hit point (or the nearest) says whether the material is soft
(`SOFT_FOR_MISSILE`: wood, sponge, rubber, ice, dissolve, floaty,
glass, light, hazard, the drawn bodies; a custom material under 0.012
density), and a soft hit punches a circle of the blast's radius out of
the object in its own frame (`subLocalPoly`, then `rebuildFromPieces`,
`splitObject` if it came apart, `removeObject` if nothing is left),
while a hard hit (metal, dark matter) gets a **scorch** — a sticker
gadget with a generated dark blob (`scorchDrawing`), `scorch: true`,
trimmed to the host as stickers are, gone with Play's snapshot.
Carson: "punch holes in certain soft materials on impact, heavy metal
not affected, just leaves a black stain".

## The rocket

LBP's rocket (`kind:"rocket"`, Gameplay, host required): `angle`
degrees round from straight up in the host's frame is the way it
pushes; `strength` in gravities — each gadget step while on (wired:
the signal; unwired: always the world runs) it applies `mass × |g| ×
gravity.scale × 1.5 × strength` at its own spot along that direction
(`Body.applyForce`), so 1× lifts its host and a half, and off the
middle it turns the host as a real one would; a flame puff every third
step. Nothing to push on a locked or decorative host (the box says
so). `firing` is what the glyph and the suites read.

## Too fast, too hard

Every free body is capped at `MAX_SPEED` (48 px/step) and `MAX_SPIN`
(0.45 rad/step) in a `beforeUpdate` step beside `keepInside`, the
player at the speed cap only — nothing outruns the walls' thickness or
the solver. And a thing of several materials flung past `BREAK_SPEED`
(34) or spun past `BREAK_SPIN` (0.32) **comes apart into its pieces**
(`breakApart`: each material piece a new object through
`newObjectFromPoly` with most of the motion, a puff, the original
removed — its gadgets and bolts with it). `objectCanBreak` rules out a
locked, decorative or one-piece thing, a projectile, and anything
wearing a creature, custom object or eye. Carson: "when things spin too
fast or get hit too hard they break to avoid breaking the game".

## Squashed

`crushCheck`, an `afterUpdate` step: the deepest overlap between the
player and any solid (`Query.collides` depths; a carried object left
out) past `CRUSH_FRAC` (0.42) of the body's narrow side for
`CRUSH_STEPS` (10) steps in a row is a crush, not a graze — a landing
dents a body a pixel or two, a squeeze pushes right into it — and the
character dies (zap, shake, "Squashed!", `respawnPlayer`). In Play, and
in Build whenever the world runs ("even in create mode"); never while
flying, hanging on a grab, paused (the paused walk backs out of
overlaps itself) or in the grace after a respawn. Carson: "don't make
these too sensitive".

## The save tabs

Build → **My Creatures / My Projectiles / My Particles** (drawn objects on
My Objects, above the built ones): `renderMyThingsTab`, a thumbnail
grid from `mySkins[kind]`. **A saved drawn thing carries the whole of
it** (`packDrawnThing`: the skin, and for a creature or object the
hitbox, art size, ghost, action mode, weak spot, danger, facing, range,
speed, fly; for particles their settings) — an older entry that is only
a skin still loads (`savedThingSkin`, `applySavedThing`). **Place** puts
it in hand (`placePreset`, the kind's own tool) and the next placement
arrives ready-made: `placeGadgetAt` applies the saved thing and runs
`applyDrawnSteps` instead of opening the studio. Picking any other tool
drops the preset.

## Links: pistons and rope

A link joins two objects at two points, one on each — any layers, because a
link is a length between two spots rather than a pin through one. `links[]`,
placed with **two clicks** (first object, then the other; Esc between them
cancels), selected by clicking the rod or rope, box on right-click.

**Piston**: a rod that extends and retracts between `min` and `max`, `time`
seconds per stroke, `pause` at each end. A Matter constraint with its
`length` animated. Wired, `flipper` decides what the signal does — `off`:
the cycling runs while the signal is on; `in` / `out`: the rod goes to that
end while the signal is on and back when it drops.

**Stiff is kinematic, not solved.** A single distance constraint cannot
hold an angle at all — the rod swung to vertical under any load, 209px of
droop, measured. A truss of three constraints held it to 4px. Carson wanted
bulletproof, so the free end is not solved at all: it is *placed*.
`refreshStiffRef` remembers the rod's world angle from the base's anchor,
the base's angle at that moment, and the free body's angle relative to the
base; `pistonSnap`, in an **`afterUpdate`** step, puts the free body exactly
where those and the length say, every frame, after whatever the solver did
— and hands it the velocity that motion implies, so the next integration
lands almost there anyway and contacts feel the push. 0px of droop with a
weight dropped on the far end. Whichever end is dynamic is the one placed;
both static, nothing to do — unless an end is Back or Front scenery, which
has no physics to be still *with*: `stiffRoles` then makes that end the
target and the piston drives it by hand, as the Mover does, so a piston on
the Back layer moves scenery. Carson: every tool usable on every layer.

**That reference is the design pose, and stiff is the default.** It is
taken when the piston is placed and re-taken only when the pose is
legitimately changed from outside — a rebuild (`relinkAfterRebuild`), a
resize or flip (`carryLinks`), an end dragged somewhere new. It is *not*
re-taken when stiff is toggled: a piston left loose, whose far end swung
down under gravity, then set stiff, snaps back to the pose it was built in
rather than freezing wherever gravity left it. That was exactly what Carson
saw and reported as "still moved around". If one end gets locked or freed
mid-flight, the same pose is re-expressed from the other end rather than
re-taken.

Rotating the free body's anchor: Matter keeps `pointB` rotated to the angle
it last saw, so after `Body.setAngle` the offset is rotated here by the same
delta and `angleB` set to the new angle — or Matter would rotate it again at
the next solve.

Reach runs to 3000px on both piston sliders and rope length; a rope can be
80 segments.

**Rope**: `length` long. **The load is carried by one tether; the chain is
for looks.** A chain of small bodies that bore the load stretched to half
again its length under a metal block — the physics engine losing to a mass
ratio of hundreds to one. So `l.constraint` is a single stiffness-1 tether
between the anchors and `l.segs` is a chain of tiny non-colliding sensor
bodies tied to each other and to the ends, which hangs, swings and sags and
carries nothing.

**The tether is made one-sided by switching it off, not by shortening it.**
A distance constraint is a rod — it pushes as well as pulls — so setting its
length to the current distance while slack made a rigid rod at whatever
distance the rope happened to be, and it could never pay out. Each step:
ends further apart than the rope is long → length = rope, stiffness 1;
closer → stiffness and damping 0. The step where it first goes taut
overshoots a few pixels and snaps back, which is the jerk of a rope catching.

A selected rope draws its reach (`drawRopeReach`): a faint circle of the
rope's length about the end that does not move, a dashed line the rope's
length toward the far end, and the number — most useful paused, before it
has hung.

`relinkAfterRebuild` re-points every constraint of a link at a host's new
body after a rebuild and re-derives the anchor from where it was;
`carryLinks` maps anchors through resize and flip. Removing a host removes
its links. Saves and snapshots carry links by object index, and wires can
point at a piston (`toLink`).

Also fixed on the way: `collisionActive` counted any overlap with the player
as ground, sensors included — a rope, a Back-layer decoration, a walk-through
light would have let you jump in mid-air. Only a solid counts now.

## Moving what is placed

With the Move tool, pressing on a gadget, a bolt, or one end of a link and
dragging picks it up; a press without a drag is just a select. `attachDrag`
holds it. Letting go over somewhere valid puts it there; anywhere else snaps
it back with no undo step left behind.

- A **gadget** rides the cursor while carried and drops onto whatever object
  is under it, on any layer, taking that object's layer. Wires are by id and
  never notice.
- A **bolt** shows the ghost while carried and needs a pair under the drop
  point, as when placing; it gets a new joint on the new pair and keeps every
  setting and wire (`moveBoltTo`).
- A **link end** — the knobs on a selected piston or rope — goes to any
  object that is not the other end's (`moveLinkEndTo`). A piston widens its
  reach to fit the new span and re-takes its design pose; a rope re-hangs.

## Dragging with physics on

An object with its physics on — free, solid, Mid (`dragHasPhysics`) — is
not teleported under the cursor but **driven** there: it stays dynamic
and a `beforeUpdate` step gives it a velocity toward its target (the
spot the cursor has dragged it to, `dragging.targets[i]`) every step,
angle held, so the engine resolves what it meets — a wall stops it, a
loose crate is shoved along in front of it. It used to be translated
straight through everything and left overlapping whatever it was
dropped in: Carson's "objects just merge into each other when moving
them". The drive is 0.3 of the gap a step, capped at 9px, and **when the
object is blocked it leans rather than shoves**: if it moved much less
than it was told to last step, the cap drops toward 1px, so a crate
pinned against a wall is not driven into it (a 22px/step drive left 30px
of overlap; this leaves none). Paused, there is no engine to resolve
anything, so `tryMoveObject` moves it by hand and backs out of a solid,
axis by axis, as the paused walk does. A locked, decorative or
walk-through object — physics off — is frozen and translated as before,
through anything. `endDrag` restores static only for those.

## Screen and world

**Measure from the canvas, never the wrapper.** `#canvasWrap` has a 5px
border and the canvas sits inside it. `resize()` sized the pixel buffer from
the wrapper's rect, 10px larger than the canvas is displayed, so everything
was drawn 0.8% small and soft, further off toward the right; and
`screenToWorld` subtracted the wrapper's corner, so every click landed 5
screen pixels right and down of the cursor. The two compounded: paint never
landed quite under the cursor, and by how much depended on where on the
screen you were. Both now use `canvas.getBoundingClientRect()`. The test
hook `w2sPage` always did, which is why every suite kept meeting a 5.88px
offset — that number is 5px at the default zoom, and it was the game.

## Grabbing

LBP's grab, not a grapple. **Hold grab while touching grabbable material
and your hands close on it where they are; let go and they open.** Hanging
sponge — on a rope, a bolt, a piston — you swing with; loose sponge on the
ground you drag. Grab in mid-air to catch a swinging one. Grab is a held
key, as LBP's R1 is: the **right mouse button in Play** (`grabMouse`) is
the default, with **Q** on the keyboard (rebindable, `grab`) for Build or
preference. No aiming: the mouse position means nothing to it. Jump does
nothing while hanging — only letting go of the grab lets go.

**Carrying.** A grabbed object that is **light enough and loose** is not
pinned to — it is picked up. `canCarry`: dynamic, mass at most
`CARRY_MASS_RATIO` (3) times the player's, and `!isAttached` — nothing on
a bolt, rope or piston is carried, however light, because that is
something you swing from. The player keeps walking, jumping and everything
else while carrying; letting go on the move throws it. There is no
constraint. `carryHoldPoint` puts the drawn hands on the object's near edge.

**It is carried on a ring, and it goes around you.** The cursor chooses
only the *direction*; the distance is `carryR`, fixed at pick-up — the
distance it was at, clamped to at least the player's half-diagonal plus
the object's plus 6px (so it can never overlap you) and at most
`CARRY_REACH` (120px). The direction `carryDir` turns toward the cursor at
most `CARRY_TURN` (0.11 rad) a step, the short way round, or over the top
when the cursor is straight across (under the feet there is usually a
floor). Before this the object was driven straight at the cursor, clamped
to reach, so pointing across yourself flew it *through* you — and being
driven by `setVelocity` it shoved you 200px across the room on the way.
The object is driven at 0.34 of the gap per step, capped at 16, so it
follows briskly but cannot punch through a wall.

**And it does not collide with the player at all.** `CARRY_GROUP` (-9) is
the player's collision group always (`playerFilter`) and the carried
object's while carried, re-applied every step since a rebuild hands the
object a fresh body, and cleared in `dropCarried` — the one place `carried`
is nulled. Matter treats a shared negative group as never-touch. That is
what makes riding what you hold impossible (there is nothing to stand on)
and it is why nothing you hold can push on you. The cost: when its spot is
unreachable — under your feet, with the floor in the way — nothing would
stop it settling inside you. `carryKeepOut` is the one-sided version of a
collision done by hand: `Query.collides` (which ignores filters) between
the player and the object, and the OBJECT is translated out along the
collision normal by the depth, with the inward part of its velocity
removed — never the player. It runs before the step, with the velocity
about to be set, and again in an `afterUpdate` step so the drawn frame is
clean. Measured with the cursor swept across the player and held under the
feet: 0px of overlap, 0px of player movement.

**A load makes for a poorer jump**: `carryJumpScale` is `1 - load * 0.22`
(floor 0.2) where load is the carried mass over the player's — about 150px
of jump with your own weight in hand, about 30 with three times it.

**You cannot ride what you are holding.** Carson found the obvious exploit:
point the cursor under your feet, the object floats there, stand on it,
jump, repeat to the top of the map. The first fix was a pile of heuristics
in `collisionActive` — detect feet-on-top, drop it, latch the grab, refuse
it as footing for 700ms. All gone: with `CARRY_GROUP` there is no contact
to stand on, and the ring keeps it out from under you anyway. The test
still jumps a dozen times with the cursor under the feet and ends on the
floor, sponge still in hand.

**Any object can be made grabbable, or not,** from its box: `o.grabbable`
(`true`/`false`, undefined = follow the material), saved as `grab`. So a
little wooden crate can be carried, or a sponge made ungrabbable.

**Sprint** is Shift (rebindable, `sprint`): `WALK_SPEED * 1.45`, a bit
quicker rather than a dash — LBP has no sprint at all, so it stays modest
enough that levels built at walking pace still work. Applies to the paused
walk too.

The grip is `grabConstraint`, a short stiff constraint from the player's
centre to the hold point, the length it was at the moment of the grab so
nothing snaps — and then grown, 1.5px a step, to at least `grabMinLen()`,
the player's own corner reach (chamfer-aware, about 31px for medium). A
grip shorter than that pulled the body onto the thing it held: grabbed by
the side at 20px, then swung under it, the top of the head was 28px above
the centre and 8px inside the sponge, with the collision pushing out and
the grip pulling in every step. `grabTarget` finds it: `grabbablePartsNear` narrows by
bounds to parts whose material is `grabbable` (the flag was `ropeable`),
then `Query.collides` between `grabProbe` — a rectangle `GRAB_REACH` px
bigger than the player on each side, never added to the world — and each
part; the hold is the average of the collision's support points. `pointB` is
the world offset, not `toBodyLocal`: Matter keeps it rotated itself (see
Bolts), and the old grapple had that wrong.

**The reach glow strokes the object's outline, not its physics parts.**
With grab held and nothing held, grabbable material within reach glows.
It used to stroke each convex *part*'s vertices, so the shared inner
edges of a decomposed shape drew as bright lines straight through it —
and since carrying holds no constraint, that branch ran the whole time
something was carried. Carson's "bright white line through the grabbable
object". Now: `mpPath` of each grabbable piece in the body's frame, and
never while carrying.

**While holding, walking pumps the swing rather than setting the speed.**
The walk code sets the player's sideways velocity outright every step; on a
grip that would kill the swing's momentum the instant the key was released.
So the movement step returns early while grabbing, after applying a small
sideways force from left/right: `vx * mass * 0.00028`, a third of what it
was, and the player's speed on a grip is capped at `SWING_MAX_SPEED` (10
px/step). Unbounded, the pump built up past 20 px/step, which is faster
than Matter resolves a contact, and the player went straight through the
sponge — Carson's "clip into grabbable objects just by moving too fast".
Measured pumping flat out for six seconds: 10.4 top speed, 0.6px overlap.

Grabbable material within reach glows while grab is held and nothing is
held yet; hands are drawn closed on the hold while it is. The rig's arm
already reached toward the hold and still does. `rebuildFromPieces`
re-points the grip at a host's new body, so a sponge flipped or painted on
under your hands stays held.

Gone: `grappleTargetAt`, `startRope`, the reticle, the world-settings Rope
Length slider (`worldSettings.ropeLength` remains in the save for
compatibility and is unused).

`#toast` is `pointer-events:none` — a passing notice was swallowing paint
strokes that landed under it.

## The fill

A fifth "Draw with" mode on the Materials page, `paintMode === "fill"`:
click inside a closed outline and the inside fills with the material,
or with water. The inside is a **hole in the union of everything solid
on the build layer** (`solidUnion` → `pgUnionMany`; fluids and mask
pseudo-materials left out), so any material bounds it, and an area
open to the map's edge is not enclosed at all — Carson's roadmap: "draw
a weird closed outline in wood, fill the interior with any material".
`enclosedRegionAt(x, y, layer)`: a point on material is nothing to
fill; otherwise the hole ring containing it, reversed to an outer,
cleaned, less any island sitting inside it (`pgDiff` with the union).
The union is cached (`fillCache`) by `layerGeomKey` — every object on
the layer's id and `geomRev`, a still object's position and angle
exactly, **a free object's at 24px and a tenth of a turn** — so hovering
does not redo it unless something changed. An exact key on a moving
creature or a falling crate changed every frame and had the union — tens
of milliseconds on a big level — redone every hover tick, with the Fill
mode remembered across sessions: Carson's "the game is very laggy now".
The hover preview is recomputed only when the cursor has moved, at most
four times a second, and **given up for the session once a union has
taken over 40ms** (`fillHoverSlow`; a click still fills — `fillAt` gives
it another chance).

The fill is committed through `paintPolyOnLayer` — the tail of
`commitShapeDrag`, factored out — with an explicit host list from
`objectsAlong(region, layer)`: the objects whose edges the region's
corners lie on (within 3px). `objectsTouching` would not have found
them: a fill only *touches* its outline, and the near-miss test there
is on the centroid, which is nowhere near the walls. So a fill welds to
the outline it fills, as paint welds to what it grazes. Water fills by
sampling cells inside the region (Mid layer only, as pouring is). The
right button in fill mode is the freehand cut, as it is in brush mode.
`tfill.js`.

## The jump

**Ground is what is under you.** `collisionActive` used to count any
touch with a solid as footing, so pressing against a wall made you
"grounded" and hammering Space climbed it — 409px up an 300px wall in
the test, and over. Now the contact's normal has to be mostly vertical
(`|n.y| >= 0.55`: a floor, or a slope up to about 57° that you could
stand on) and its support points have to sit below the player's middle
(a floor, not a ceiling you bumped). Only `|n.y|` is used, so which way
Matter happens to point the normal does not matter.

**And it is forgiving at both ends.** `grounded` is exact — one step off
a ledge and it is false — which Carson felt as "I can't jump if I'm half
a pixel off the ground". `canJumpNow()` allows a jump for `COYOTE_MS`
(120) after the last grounded step, provided you are not already on the
way up (`velocity.y > -1`), so it is never a second jump. And a press up
to `JUMP_BUFFER_MS` (130) before landing fires on landing instead of
being thrown away: `input.jumpBufferUntil` is set with `jumpQueued` and
cleared by a jump, by hanging on a grab, and by a mode switch.
`tjump.js` has both, plus the controls: too late off the ledge is just a
fall, a press long before landing does nothing, a second press mid-jump
adds nothing.

**The double jump is a level setting** (`worldSettings.doubleJump`,
World → Player, saved with the level, off by default): one more jump in
the air (`canDoubleJumpNow`: not grounded, `airJumps < 1`, not hanging,
not flying), on a fresh press only — a buffered press is for landing —
a little lower than a ground jump (−12.5). `airJumps` is cleared by the
ground, so a walk off a ledge still gets one.

**Crouch and slide.** Down on the ground crouches (`setCrouch`): the
body is rebuilt squashed toward the feet by `CROUCH_K` (0.6) —
`buildPlayerBody` scales the drawn hitbox with `pgScale` about the feet
line, or shortens the box — swapped in place with the feet where they
were, velocity and ground kept, so a crouched character fits under a
low shelf. The picture squashes with it (`charArt` is the crouched box),
and the studio has **Crouch** and **Slide** poses whose drawing box is
the squatter one (`aspect()` per state), so a drawn pose is not
distorted. Walking crouched is half speed. Letting go of Down stands
you up — unless something is over your head: a probe tall body is
tested with `Query.collides` against everything solid first, and a
refusal is tried again every step until you are clear. **Down at a run
is a slide** (`sliding`, `SLIDE_MS` 480, its own speed `slideV` easing
by `SLIDE_DECAY` a step, set outright so floor friction does not eat
it): the keys do nothing until it is over, then you are crouched while
Down is held. Every spawn stands you up. Both events, `collisionStart`
and `collisionActive`, feed `groundContacts`: a pair's first step is a
Start, so a body swapped in mid-step read as airborne for a step and
cancelled the slide it was made for.

**Ice is skated on.** The walk sets the sideways speed outright every
step, which is why ice was only slippery for objects: the player
stopped dead when a key came up, and the sideways push a slope gave
them was overwritten before it could add up. `groundMat` is the
material of the part the feet are on (`groundMatNext`, recorded with
`groundBodyNext` from the pair's part `plugin.materialId`); on one with
friction at or under `ICE_FRICTION_MAX` (0.05 — ice is 0.02, glass at
0.3 is only a little slick) the keys are an acceleration of `ICE_ACCEL`
(0.22 px/step²) toward the walk speed and letting go multiplies by
`ICE_BRAKE` (0.994) a step, so you coast, and an icy slope takes you
down it whether you like it or not; the speed is capped at three times
the walk. Carson: "ice must get slipperier on a slope".

## Water, the eraser and the vacuum

**The eraser works on the layer you are on.** `eraseStep` used to take
`objectsTouching(seg, null)` — any layer — so erasing a Mid detail ate the
Back decoration behind it. It passes `stroke.layer` now, like a cut always
did. Water is Mid's, so the eraser mops it only from Mid. Carson's ask.

**The Vacuum** (`currentTool === "vacuum"`, on the Materials page beside
Erase, `canvas.dataset.tool = "erase"` for the cursor) is an erase stroke
with `stroke.vacuum` / `waterOnly`: `removeWaterAt` and nothing else — no
objects on any layer, no bubbles, checkpoints or bolts, which a plain
erase stroke also sweeps. Its cursor is the eraser's ring in water blue.
`removeWaterAt` now reports whether it took anything (for the sound) and
recomputes the column tops when paused, since no step will.

**Thin water dries up.** `W_DRY` (0.22) and `W_EVAP` (0.0011 a step): in
`stepWater`, before falling, a cell under `W_DRY` with less than half a
cell of water beneath it loses `W_EVAP` — a film of 0.2 is gone in about
two seconds, a fleck in less. The surface cell of a real pool sits on
full cells and is safe; a pool 1 cell deep and under 0.22 full is not,
which is the point: that is the leak, the spray, the smear a draining
pool leaves, "these little bits of water everywhere". `twater.js`: a
film of 0.12 across a floor is gone in three seconds; a pool keeps 90%+.

**Cells are 8px** (`WATER_CELL`; they were 16). A level file carries
`waterCell`, and `unpackWaterSparse` resamples a save made on another
grid — a file from before the field is taken as 16. Snapshots are in-
session and need nothing. The cost was in the drawing, not the sim: the
step is 0.18ms and the solid stamp 0.04ms for an 1100×250 pool, but a
round blob per cell was 4,000 arcs a frame and the GPU took the frame to
12.8ms. **Interior cells — wet or solid on all four sides — are drawn as
one rectangle per run**, and only the cells on the outside of the mass
are blobs: 0.19ms to draw, 8.3ms frames, same as no water at all.

**Splashes.** `splashAt(x, y, size, vy)`: two puffs of spray scaled by
size and speed, `disturbWater` knocking the surface (a dip in the middle
columns, a crown either side, which the simulation rolls outward as a
ripple), and the splash sound past a small speed. Fired for an object the
step it first reads wet (`o.wet`) with `velocity.y > 3.5`, and for the
player likewise (`playerWet`); static objects never. `waterSurfaceY`
picks the painted surface or the world's, whichever is higher.

**One surface, not beads.** `drawWater` used to draw every open top cell
as its own droplet, so a calm pool read as a string of beads along the
water line. Now, per visible column, the highest open top cell is found
(`tops`), and runs of neighbouring columns whose tops are within a row of
each other are drawn as one closed shape: a quadratic curve through the
water line (with two slow ripples) along the top, straight down the
sides, back along the bottoms of the top cells into the blob body below.
A lone top, or a second open surface lower in the same column (a pool
under a shelf), is still a droplet. Then a thin bright line along each
surface and a soft wider glint under it. The blob body and the trimming
redraw of static scenery are as they were.

## The physics clock

**120 fixed steps a second, on every screen.** Matter's own `Runner` steps
once per animation frame and never lets a step be shorter than 1/60s, so
on a 120Hz screen it ran the world 120 times a second at Matter's nominal
16.7ms — and that is the machine this was built and tuned on (measured:
121 frames and 120 steps a second). Every speed, jump and fall Carson
tuned by feel is a per-step number taken 120 times a second; on a 60Hz
screen the same level ran at half speed. `physicsFrame` replaces the
Runner: a real clock, an accumulator, and exactly as many `Engine.update`
calls as 1/120s slices have elapsed — two per frame at 60Hz, one at
120Hz, up to six after a stall so a tab back from the background does not
spend a second catching up. Each step still hands Matter `MATTER_DELTA`
(1000/60), because that is the unit every per-step number here is written
in: velocities are *px per step*, and there are `STEPS_PER_SEC` (120)
steps to a second. **Anything that counts real seconds goes through
`stepSeconds()` or `STEPS_PER_SEC`**: a piston's stroke, a wobble's period,
a mover's speed, a motor's rpm (`rpm()` — 0.02 rad/step is 23 rpm, not the
11 the old comment said). `runner` is now a plain object; `runner.enabled`
is still the pause switch everything reads.

Test suites were written against this machine, so their timing windows
were already 120-step windows. The two that assumed 60 (a bolt's swing in
700ms, a jump's flight in 800ms) were widened when the clock was first
tried at 60 and are left wide.

## Riding what you stand on

The walk sets the player's sideways speed outright every step, which
wiped out whatever carry a moving platform's friction gave — you stood
still while it slid out from under you (the player's friction is 0.02
anyway). `groundBody` is what the feet are on (recorded with `grounded`
in `collisionActive`), and `groundVel()` is its velocity at the feet —
`v + ω × r`, so a turning wheel's surface counts — added to the walk. A
platform dropping away takes you down with it rather than leaving you
floating (`vy` follows the ground's when it is faster downward). A jump
keeps the carried sideways speed, as it should.

## Creatures

Carson's Creature eye, built to his spec with the liberty he granted on
the details. Drop it on an object and the object is a creature: the eye
(the glyph's pupil, `g.look`, refreshed even while paused so it watches
you walk about in Build) follows the player; once they are within
`range` the creature chases them at `speed` — left and right on the
ground by default, or in every direction floating with `fly` — and
stops just short of them (`stopX`: its half-width plus the player's plus
8) rather than shoving in. `creatureStep` each `beforeUpdate`: a real
physics body still — it falls, pushes, rides a platform — with its
sideways velocity set toward the player (vertical too, ignoring gravity,
for a flier; a flier out of sight hangs where it is) and its angle held
at what it was when first driven, so a walking thing never tumbles. A
locked host only watches. Chasing the player through a wall is not
attempted: it walks into it and stops.

**The weak spot and the danger are painted on.** `weakMode`: `eye` (the
default — landing on the eye, `groundBody` is the host and the feet are
within the eye's width and just above), `painted` (the drawn area), or
`none` (unsquashable; the old `deadly:false`, still written for older
readers). The danger is always a drawn area. Both are MultiPolys in the
host's own frame like its pieces (`g.weak`, `g.danger`), saved packed,
carried through a rebuild (`maskToWorld` off the old body,
`maskToLocal` onto the new, in `rebuildFromPieces`) and through resize
and flip (`carryGadgets` maps them through `mapPt`).

**Painting them** (`maskPaint`, `beginMaskPaint`, `endMaskPaint`): the
box's "Paint the weak spot" / "Paint the danger" swaps the brush for one
of two pseudo-materials — `maskweak`, `maskdanger`, `isMask:true`, in
`MATERIALS` but never in `MATERIAL_ORDER`, so they are never a body — and
every stroke, drag-out shape and right-drag cut goes through the ordinary
painting code, caught at the commit (`commitStroke`, `commitShapeDrag`,
the cut stroke in `eraseStep`) and put into the area by `commitMask`:
unioned after clipping to the host's own pieces, or differenced. Esc,
picking another tool, or losing the selection ends it and hands back
Move. The areas draw on the host in every mode (the danger a red warning,
the weak spot a pale target) unless the gadget is hidden in Play.

**Contact is geometry, on every layer.** `creatureContactCheck` uses
`Query.collides(player, [host])` — it ignores collision filters, so a
Back or Front creature, which the player can never physically touch,
counts when they overlap it, which is what Carson asked for ("effect
every layer"). The collision's support points go into the host's frame
and are asked against the areas: in the danger, the player dies as a
hazard kills them (zap, shake, `respawnPlayer`, the same 900ms grace); in
the weak spot, `creaturePop`. **Play only**: in Build a pop would take
the object with it for real, and Play's snapshot brings it back.

**A creature on the Back or Front layer** has no physics to walk with,
so `creatureStep` moves a `decorative` host by hand (`Body.setPosition`)
toward the player, floating, left and right only unless `fly`.

**The eye is a googly eye** — white, a dark rim, a big pupil in `g.color`
(the box has a palette; default black) that rolls toward the player,
with a highlight. The pop's spray takes the colour too.

## The studio

One drawing-and-animation editor for everything drawn — `#charEditorOverlay`,
the old character creator, rebuilt around a **subject**: `ceSubject` says
what is being drawn (its `states()`, `frames(st)`, `count`/`setCount`,
`fps`/`setFps`, `aspect()`, `persist()`, a `hint`, optional `modes`, an
optional `backdrop(ctx,w,h)` drawn faint under the art, an `extraRight(el)`
for its own controls, an `onClose`). `ceCharacterSubject()` is the
character; `ceSkinSubject(g)` is a gadget's skin. Everything else is the
studio's.

**Undo/redo** (`ceHistory`): whole-frame snapshots, one per change —
`ceBeginChange` before a stroke or edit, `ceEndChange` after, which pushes
`{st, fr, before, after}` only if something changed (80 deep). Undo and
redo jump to the frame they belong to. **`ceApplyHistory` writes the
frame back through `subject.setFrame`**, not into the array `frames()`
returned: a drawn step (the hitbox, the weak spot) hands out a fresh
one-element array each call, so writing into it changed nothing —
Carson's "I can't use Ctrl+Z while drawing the hitbox". Inserting, deleting or moving a
frame clears the history rather than trying to reconcile indices.
Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, Ctrl+C/V copy and paste a frame.

**Tools**: brush; straight line (`ceTool = "line"`, or Shift while
brushing — the stroke keeps only its first point and the cursor);
eraser (a stroke with `c: null`); eyedropper (`cePickAt` reads the
drawing's own raster, not the guides or onion skins); any colour (a
native colour input, the palette, and `ceRecent`, the last ten used);
opacity (`a` on the stroke, honoured by `paintDrawing`); symmetry
(`ceStroke2`, the mirror stroke, pushed alongside); a stabiliser
(`ceSmooth`: the point lags the hand by half); centre guides; brush down
to 0.6% of the box. **Zoom** (`ceZoom`, `ceCX/CY`): the wheel zooms about
the cursor, Space-drag or the middle button pans, `0` resets; the
drawing is rasterised at the zoomed size and the view rect drawn, so the
box edge stays visible. `ceNorm` takes the view into account, so strokes
land where the cursor is at any zoom.

**Frames**: insert blank or a copy after this one, delete, move either
way, up to `CHAR_MAX_FRAMES` (48, was 12); arrows step; **playback** (P)
cycles at the state's speed — `charFps` per state for the character
(default 8 for run, 2 otherwise), used by the game too
(`currentCharAnim`), saved in the character and in `pg_char_fps`.
Onion skin: the frame before at 0.22 and, if wanted, the one after at
0.12. Keys while open: B E L I X O G [ ] 0 P, the arrows, Space to pan.

**The brush shows itself** (`ceCursor`, set on every pointermove over the
stage, cleared on leave): a ring at the pointer exactly the size the next
dab covers — `ceBrushW * v.h / 2`, in the view's own pixels, so it is
right at any zoom — white with a dark dashed ring inside, red for the
eraser. Not drawn for the eyedropper. Carson: "show a visual
representation of what is about to be drawn".

**Filled shapes**: Box (R), Oval (C) and Lasso (K). A shape is a stroke
with `f: true` and no width: its `p` is the outline (four corners; forty
points round an ellipse; whatever the hand drew), which `paintDrawing`
fills and `drawingToPoly` takes as an exact polygon, so a boxed hitbox is
a box. Shift while dragging makes a box square or an oval round. The
outline shows while dragging (`ceShape`); symmetry mirrors it. Also
**Mirror** (M) and **Flip upside down** (V) for the whole frame,
**Shift+arrows** nudge it by 1% (`ceNudge`), and **◐ Smaller / ◑ Bigger**
scale it about its centre (`ceScaleFrame`) — all through
`ceBeginChange`/`ceEndChange`, so each is one undo.

**The bucket** (🪣 Fill, F): `ceBucketFill` floods a raster of the
drawing (`CE_FILL_RES` 256 on the long side) out from the click over
pixels of the seed's kind — empty (alpha under 150, so the fill tucks
under a line's soft edge with no seam) or near the seed's colour — and
traces the region's outline back into a filled shape: cell edges walked
with the fill on the right (an outer ring clockwise, a hole the other
way), straight runs merged, one Chaikin pass to take the stairs off
diagonals; the biggest loop is the outline, the rest are holes. A filled
shape may now carry holes — `{f:true, p, h:[ring…]}`, painted even-odd,
and `drawingToPoly` builds the Poly with them — so a fill round an
island leaves the island, and a click on a colour recolours that area.
With the eraser it clears the area (`c:null`), and the shape tools can
erase too now (`ceDoAction` no longer forces a colour for them). No
brush ring in fill mode. Carson: "add the fill tool to the character,
creature, material and particle editors" — one studio, so all of them.

**The colour wheel is a labelled button**, not a bare swatch: `.cePickWrap`
wraps the native colour input in "🎨 Colour wheel — any colour" with a
conic-gradient ring, so it reads as the place to get any colour.

**The Settings card** (⚙ Settings in the header, `#ceKeysPanel`,
`renderCeKeysPanel`): every key the studio uses, each rebindable —
`CE_KEY_DEFAULTS` is the list (brush, eraser, line, pick, rect, ellipse,
lasso, symmetry, onion, guides, smaller, bigger, play, resetView, flipH,
flipV), `ceKeys` the live map, saved in `pg_ce_keys`. Click a key,
press the new one (`ceKeyWaiting`; Escape keeps the old); "Back to the
usual keys" resets. The keydown handler resolves keys through `ceKeys`
and `ceDoAction(act)`, so the chips' key tags (`ceKeyTag`) and the card
always agree. It floats over the stage from the header rather than
sitting at the bottom of the right column, where it scrolled out of
sight. Opening the studio closes it.

**Nothing in the two columns shrinks** (`#ceLeft > *, #ceRight > * {
flex-shrink:0 }`): they are flex columns that scroll, and the frame strip
(`overflow-y:auto`, so its min-height is 0) was being crushed to a sliver
as the left column filled with steps and states — Carson's "bring back
the frames on the left".

**The rig ("Simple Animated") mode is gone**, at Carson's ask — the
four-part procedurally posed character, its editor, `rigSprites`,
`rigAnchors`, `RIG_*`. A saved character with `mode: "rig"` loads as
`animated`. `charMode` is `preset`, `simple` or `animated`.

## The character's size and hitbox

**Twice the size it was, by default.** `charScale` (0.5–3.5, `CHAR_BASE_W/H`
40×56 at 1) replaces the three fixed sizes: the default is 2, so a fresh
character is 80×112. Carson: "the character is naturally REALLY small".
Saved in `pg_char_scale`; an older `pg_char_size` (small/medium/large)
is read once and turned into a scale; the character file carries `scale`
and `hit`. `setCharScale` rebuilds the body in place
(`respawnSameSpot`: same spot, same velocity), so the Character tab's
Size slider and the studio both resize you live.

**The studio's wizard is Size → look → Hitbox** (`ceCharacterSubject`
states `[CHAR_STEP_SIZE] + looks + [CHAR_STEP_HIT]`; `isSize`, `isMask`,
`next`). A character with nothing drawn yet opens on the Size step
(`openCharEditor`); one with art opens where it was. **The Size step's
stage is the level itself, live** (`subject.stage`, drawn by `ceRedraw`
in place of the drawing box, the stage the full width, redrawn every
`ceTick`): `sizeStagePreviewWanted()` joins `worldPagePreviewWanted()` in
`updateCamera`, so for as long as the step is open the game's camera sits
on the character at the Play zoom and height (the editor's view held in
`edCam` and restored after, as the World page does), and the stage blits
the game canvas around them — clamped to the screen, since the camera
stops at the map's edge — with a measuring line, the height, and the old
40×56 size as a dashed outline beside them. So what you see is exactly
what Play shows, at the size the level plays at; a scene drawn at one
pixel to one, with a 100px crate, did not match the level's zoom — Carson:
"the size in the visual representation does not really match what it
should in game". The Height slider and Old size / Twice / Giant presets
sit on the left; the wheel does nothing there.

**The hitbox is drawn** (`charHit`, one drawing, `pg_char_hit`) and
`buildPlayerBody` makes the body from it on every spawn: `drawingToPoly`
over the art box (`CHAR_BASE × charScale`), the biggest island only (a
body is one piece), `pgConvexParts` → a compound `Body.create({parts})`
with `PW/PH` the polygon's bounds and `charArt` the art box offset by
the shape's centroid, so the picture stays where it was drawn around the
new body. Nothing drawn (or a sliver under 8px) is the rounded box it
always was, its chamfer scaled with the size. `Body.setInertia(Infinity)`
as before, so a drawn shape never tumbles.

**With no hitbox drawn, the body is the drawing.** `buildPlayerBody`
takes `charHit` if there is one, else the Idle frame itself (`charMode`
not preset), through `charBodyPoly` — `drawingToPoly` cached by the
drawing's revision, size and which drawing (a crouch rebuilds the body,
and a hundred strokes are a hundred capsule unions) — so a character
drawn as a diagonal stick is a stick to the world, not the box round
it. Carson: "draw a massive diagonal line, the hitbox is huge". Nothing
drawn at all is still the rounded box. And every hitbox step — the
character's, a creature's, an object's — has **✨ Use my drawing as the
hitbox** (`subject.useDrawingAsHitbox`): the Idle drawing copied across
in the hitbox colour, one undo.

**A compound player collides by its parts.** Matter reports a compound's
pairs at the part level — `pair.bodyA` is the convex piece that touched,
whose `.parent` is the player — so `collisionActive` and `collisionStart`
go through `isPlayerPart(b)` (`b === player || b.parent === player`)
rather than `=== player`. With the old test a drawn hitbox was never
grounded and could not jump at all ("when I make the hitbox a weird
shape I can't jump"), and hazards did not fire. `Query.collides` walks
parts itself and needed nothing.

**The suites are pinned to the old size.** Every suite's geometry —
where the feet land, what fits under a ledge, how far a sponge is stood
beside — was built for 40×56, so `tenv.js`'s `launch()` sets
`pg_char_scale = '1'` on every page before the game boots unless
`pg_test_real_size` is set; `tstudio.js` sets that after clearing
storage and checks the real default. A new suite that wants the real
size does the same.

## Drawn things: the Custom creature and the Custom object

Carson's spec: *first you draw the creature, then you draw the hitbox,
then the weak spot, then the danger, and that's it*. Same for an object:
draw it, draw its collision, then its settings. The Creature eye stays
its own thing (a googly eye on any painted object); these two tools make
their own object.

**Placing** (`placeGadgetAt` for `creature` / `anim`): a box
`DRAWN_DEFAULT_SIZE` (120px) square of the `creaturebody` / `drawnbody`
material — two materials never in the catalogue — is made at the click on
the build layer (any layer: on Back or Front it is decoration that floats
after the player), the gadget goes on it with `art = {-60,-60,120,120}`,
and the studio opens. **`art` is the drawing box, a rect in the host's
own frame that the hitbox does not change**: the look is always drawn
stretched over `art` (`skinBox`), not over the body's bounds, so
reshaping the hitbox never distorts the picture. It rides rebuilds (its
world centre through `maskW`), resize and flip (`carryGadgets`: centre
through the map, size by the scale; a flip also turns `drawnFacing`).

**Those two materials must never share a name with a tool.** They were
`creature` and `drawn`, and `creature` is also the tool's id: with a
drag-out shape mode picked on the Materials page, `matOf(currentTool)`
found a material for the Custom creature tool and the pointerdown went
down the shape-painting path — a green square of creature material, no
gadget, no studio. Carson: "it literally just drew a green square".
Renamed, `unpackObject` maps the old names *before* the material check
(after it, the piece was dropped and the level came up without its
creatures), and `isMaterialTool()` refuses any gadget tool as well.

**The marker cannot come off.** With the Move tool, pressing a creature's
or object's marker starts an *object* drag of its host (`beginDrag`,
before the general gadget case) — the marker is the thing, so dragging
it moves the whole thing, body and picture. It used to lift off like any
gadget and leave the body behind: "there will just be a square in my
level".

**The wizard starts with the size.** `SKIN_SIZE_STEP` (`size:true`) is
the first state of a creature's or object's subject (`hasSize`: the kind,
an `art` box and a host): Width and Height sliders (`DRAWN_SIZE_MIN` 40
to `DRAWN_SIZE_MAX` 600) and Small / Medium / Big / Huge / Wide / Tall
presets, through `subject.setSize(w, h)` — the art box resized about its
own centre and `applyDrawnSteps` run at once, so the placeholder box (or
a drawn hitbox, whose strokes are fractions of the box) follows. The
step's stage is the live level around the thing's own spot
(`stageAim`, which the Size camera branch aims at instead of the player;
`ceLiveStage` is the shared blit both stages use) with the box outlined
at its size and the character's outline beside it for scale. A fresh
one opens here (`openSkinStudio`: no art yet → `size`); the box's
"Change the size" reopens it. Carson: "it's just a square" — it need not
be.

**The wizard** is the studio with steps: `SKIN_STEPS[kind]` are extra
"states" flagged `mask:true` — `hitbox` (blue), `weakD` (gold), `dangerD`
(red) for a creature, `hitbox` alone for an object — each one drawing on
the gadget itself (`g.hitbox`, `g.weakD`, `g.dangerD`), painted in a
forced colour (the eraser still erases), shown at 0.6 alpha over the
Idle look faint underneath (and the hitbox fainter under the other
two). No frame tools on a step. `subject.next()` walks look → first step
→ … → Done; a **Next** button on the left follows it and the step chips
tick when drawn. `openSkinStudio(g, step)` opens straight at a step, for
the box's "Redraw the hitbox / weak spot / danger".

**Nothing touches a fresh one until its hitbox is drawn, and it holds
still while it is drawn on.** Placing sets `ghost` and `ghostAuto`;
`objectHeldStill` (a drawn thing that is a ghost, or whose host has
`studioHold`) makes `refreshObjectPhysics` keep the body static; a
ghost creature on any layer takes `creatureStep`'s by-hand path (it
floats after the player as a Back-layer one does — a dynamic sensor
would fall forever). `openSkinStudio` sets `studioHold` on the host and
the subject's `onClose` clears it: a creature used to walk off after the
player, fall, and tumble while its picture was being painted, so the
hitbox went on a body that was somewhere else and rotated — Carson's
"the marker moved to the left", "the hitbox was way lower, it fell
through the ground". When the first hitbox is drawn `ghostAuto` flips
`ghost` off; a "no collision" chosen in the box (`ghostAuto = false`)
stays. The box's Body section, with no hitbox drawn, is one button that
opens the hitbox step.

**Drawings become geometry when the studio closes** (`applyDrawnSteps`):
`drawingToPoly(strokes, w, h, tol)` — every stroke is the exact shape a
round brush of its width sweeps, a capsule per segment (`sweepRing`, the
level brush's own geometry), unioned, an eraser stroke subtracted, in a
box centred on (0,0), cleaned at 1.2px. The hitbox polygon goes on
**upright, at the art box's world centre** — never through the body's
angle: it was drawn over the picture upright, so that is where it
belongs — `Body.setAngle(b, 0)`, and `rebuildFromPieces(o,
{a:0,x:0,y:0})` makes it the body, so the drawn hitbox is as clean a
polygon as a painted one. After the rebuild `g.art` is re-expressed
about the same world centre with `a: 0`, and the gadget itself is put at
the body's centre (`local` 0,0) — the marker sits in the middle of the
drawn hitbox, which is what Carson asked for. `homeAngle` is reset. A
drawn creature's body is also given infinite inertia
(`objectIsDrawnCreature` in `refreshObjectPhysics`), so it stands as
drawn whatever hits it.

**The art box remembers a turn** (`art.a`, radians, saved): any other
rebuild — painting onto the thing, a resize — bakes the body's angle
into the polygons and resets it to 0, and an axis-aligned rect in the
new frame would leave the picture upright over a turned hitbox. So
`rebuildFromPieces` adds `oldAngle` to `art.a`, `drawSkinOn` rotates by
it about the art centre, and a flip negates it. **An empty
hitbox means no collision**: the body is the art box and `ghost` is set.
For a creature the weak spot and danger become `g.weak` / `g.danger` the
same way (`weakMode` is always `painted`), so the contact code is the
eye's, unchanged.

**A creature** (`kind:"creature"`): chases as the eye's creature does
(`creatureStep`, shared), **turns to face the player whenever it sees
them** (`g.face` from the direction to the player, not from motion —
Carson found it "backwards"; `drawnFacing`, ±1 in the box, says which
way the picture was drawn, and it is mirrored when `face` differs).
Skin states: Idle, Moving, **Attack** (played once from `attackT0` when
the player hits the danger, on top of the zap and respawn), **Death**
(`creaturePop` sets `dying` and `dieT0` instead of removing; it holds
still while the Death plays — `skinStateMs` — then the object is removed;
no Death drawn, it pops at once as before), and Action for a wire.
`skinStateFor` orders them: dying, attacking, wired action, moving, idle.
Settings: follows on the ground or floats, speed, sight, solid or no
collision, drawn facing.

**An object** (`kind:"anim"`, "Custom object"): look and hitbox, then in
its box solid / no collision, grabbable, locked / free, weight (the same
`applyObjectWeight` as any object), and whether a wire's Action loops or
plays once and holds. It starts locked (`forcedStatic`), as a built thing
should.

**What a tool shows**: a camera's zone and frame, a sensor's reach, a
mover's line and a creature eye's range draw only when that gadget is
selected or *its own* tool is in hand — `currentTool === "camera"` and so
on, not `isGadgetTool()`, which showed every camera's working parts while
you placed particles ("I can see the camera editing visuals").

**Particles get a guide** (selected, or the Particles tool in hand): the
direction and spread as a wedge, the path a middling particle flies (the
same sums as the particles, a frame at a time — speed, gravity, life),
an arrow head at the start and a ring the size of one particle at the
end. And `alpha`, an opacity on the particles, in the box.

## Skins

A **skin** is a set of drawn states, each a list of frames, with a speed
per state — the character's art model on a gadget: `{ states: {id:
[drawing…]}, fps: {id: n} }`, `newSkin(kind)`, `normalizeSkin`,
`packSkin`, saved on the gadget as `skin` in snapshots and the level
file. `SKIN_STATES` per kind: a creature has Idle, Moving, Action; an
animated object Idle, Action; a particle just Particle. `skinFrame(sk,
st, t0, once)` picks the frame for the time — looping, or once through
and held at the last frame — and falls back to Idle for a state with
nothing drawn. `action` is the state a wire plays: Carson's "animations
that can be triggered by levers or buttons or sensors, and even
creatures". The gadget step watches the wire's rising edge (`wasOn`,
`actT0`) so a once-through starts over each time it comes on.

**A creature or animated object with a skin is drawn with it instead of
its material** — `drawObject` asks `objectSkinGadget(obj)` first and
`drawSkinOn` draws the current frame stretched over the host's own local
bounding box (`objectPaths(obj).box`) in the host's frame, so the drawing
lands exactly on the shape and the painted shape stays the hitbox
(Carson's "custom hand-drawn hitbox"). A creature is mirrored when it
faces left (`g.face`, from the way it moves); `skinStateFor` picks
Action while wired on, else Moving when the body moves (or a decorative
one is being moved by hand), else Idle. The eye's own glyph still draws
on top. The studio for a skin (`ceSkinSubject`) uses the host's box
aspect and draws the host's shape faint underneath (`backdrop`) so the
artist paints within the hitbox; a particle's box is square. **My
Creatures / Animations / Particles** (`mySkins`, `pg_my_skins`) save and
load looks on this device.

**Animated object** (`kind:"anim"`, Gameplay page): a skin, `actionMode`
(`loop` while on, or `once` and hold), and `ghost` — "no collision at
all": `objectWalkThrough(obj)` folds into `refreshObjectPhysics`'s ghost
test, so the host becomes a sensor with an empty mask like decoration.

**Particles** (`kind:"emitter"`): `sprites[]`, capped at 600, stepped in
the render loop (`stepSprites`, `frameK` in 1/60s frames) and drawn
after the gadgets of their layer (`drawSprites(layer)`). `emitFrom`
accumulates `rate/60` a frame and throws one per whole: direction
`angle` (0 up, clockwise, ±180 down) with `spread`, `pspeed` px/s with
±20%, `grav`, `life` seconds ±15%, `psize` ±15%, `spin`. A particle's
frames play over its life (frame = progress × count), and it fades over
the last 40%. Nothing comes out until a particle is drawn; wired, it
emits only while the signal is on; paused Build emits nothing. A
particle whose emitter is gone is dropped.

## Stickers

LBP's decals, drawn by hand — Carson: "custom stickers, like LBP but you
can draw them". A sticker is a gadget, `kind:"sticker"`, with a one-state
`skin` (`SKIN_STATES.sticker`), a `size` (a square, px), a turn `rot`
(radians) and `flipX`, on any layer, on an object or on nothing
(`gadgetNeedsHost` false) — it rides with what it is stuck to like any
gadget, and drags off onto something else or onto the background with
the Move tool. **Build → Stickers**: "Draw a new sticker" opens the
studio on a draft (`openStickerDraft`, a host-less skin subject);
closing with something drawn asks for a name and keeps it in
`mySkins.sticker` (My Stickers; the studio's own save/load list too),
and puts it in hand (`stickerPick`, the `sticker` tool). A click sticks a
*copy* of the drawing there (`placeGadgetAt`: on the object under the
cursor on the build layer, else the background), at `stickerSize`
(remembered, `pg_sticker_size`, and the page's "Size when placed"
slider) and the last turn used; the ghost at the cursor shows it. The
box has Size, Turn, Flip, "Edit the drawing" (this one's own copy) and
"Another like it".

**Drawn as the picture, no marker** (`drawStickerHere`, from
`drawGadgets` in the sticker's frame): turned, flipped, the drawing over
its square, faded with its layer; selected in Build, a dashed frame.
**Stickers stick to material only** — a click on nothing places nothing
(`gadgetNeedsHost` true for them; a click finds the build layer's object
first, then any layer's through `objectAt`), and a drag off onto nothing
snaps back, as any gadget's does. Carson: "only be able to be placed on
materials". **Stuck to a thing, it is trimmed to the thing's shape** (a clip to the
host's `objectPaths` regions, back in the host's frame), as LBP trims a
sticker to the material it is on. **Picked by its picture**: `gadgetAt`
tries every marker first, then the stickers topmost-first through
`stickerHit`, the point taken into the sticker's own turned square.
Resize scales `size`; a flip mirrors `flipX` and negates `rot`. Saved
with `skin`, `size`, `rot`, `flipX`; `persistMySkins` drops the live
`skin` copies it unpacks for thumbnails. `tstickers.js`.

## The Fan

Carson's Fan: "it just blows a bit of air up that pushes the player
upwards, adjustable in size, on and off with sensors and wires".
`kind:"fan"` on the Gameplay page, host required; `width` of the column
(40–1200), `reach` (60–3000) and `strength` (0.1–2). `fanBlow` each
gadget step while `fanOn` (unwired: always; wired: the signal): the
column is `reach` long by `width` wide **up in the host's frame**
(`fanFrame` — a fan on a wall blows sideways, a fan on a turning wheel
turns with it); anything whose centre is in it — the player unless
flying, any loose Mid body but the host — has `strength × 0.45` px/step²
added to its velocity up the column, tailing off to half at the top, so
a body floats up and hovers where the push and gravity (≈0.28) balance
rather than being flung out of the level. The glyph is a housing with
blades that turn while it blows (`blade`); the air is drawn as wisps
drifting up the column in every mode, and the whole column is outlined
in Build while the fan is selected or the tool is in hand. `tfan.js`.

## The live world

A World changer is LBP2's global tweakers as one gadget. It never edits
the level's settings: `worldLive` is what the light and water level *are*
right now, `liveLight()` / `liveWater()` are what every run-time reader
uses (`waterAt`, buoyancy, `playerWetness`, the water overlay,
`drawLighting`), and the World page still edits `worldSettings`, calling
`worldLiveReset` when nothing is changing the world. `updateWorldLive`
runs at the end of the gadget step, after wires, so a changer sees a
fresh input: the target is the level's own values, overridden by the
last active changer's (`activeChanger`; `latched` once on, if `latch`),
and light and water each move toward it at a rate that crosses the whole
range in `secs` — instant at 0. "No water" is a surface 400px below the
floor (`waterLevelOrNone`), so draining and flooding ease like anything
else and a level read back as null once past the floor. Pausing Build,
entering Play and every load reset the live world to the level's own and
clear latches.

## The Mover

Carson's own spec: place it on an object, draw a line, the object follows
the line and stops at the end, or bounces back and forth; adjustable
speed; activated by a sensor or other tools. `kind:"mover"`, host
required. **Two clicks to place**: the first puts it on the object and
sets `moverDraft`, the ghost line follows the cursor, the second sets
`line` (`{dx, dy}` in world axes; a click on the spot gives a default
200px run to the right); Esc removes the half-made one. Settings: `speed`
in real px/s (5–1500, default 120), `bounce`. The line draws green with
an arrowhead one way, orange with heads both ways for a bounce, when
selected or with the tool in hand; a knob at the end drags (`attachDrag`
kind `moverEnd`, one undo per drag on the first move). Resize and flip
map the line through `carryGadgets` like the spot.

**Choosing where it goes is a mode of its own.** `moverDraft` is the
mover waiting for the click; the canvas's pointerdown hands the click
to `moverSetLine` before anything else, whatever tool is in hand, so
picking Select (or opening the box) in between no longer leaves a line
that follows the cursor and a click that does nothing — Carson's "the
mover seems to be broken". The box's "🎯 Choose where it goes" starts
it again on a placed mover; Esc keeps a placed mover's run and takes
away a fresh one (`fresh`, set at placement) that had none. The box
stays open through the click.

**The host is driven, not solved** — the stiff piston's approach. `home`
is taken when the world starts running (`moverHomeAll`: entering Play,
unpausing Build), so the travel begins from wherever the object is right
then, and an object moved in Build travels from its new spot. Each
`afterUpdate`, `moverAdvance` moves `u` along the line at the speed
(`moverRunning`: wired, while the signal is on; unwired, always) and
`moverSnap` puts the body exactly where that says — the gadget's own
point is driven to `home + line·u`, the body's angle is held at its home
angle, the velocity is set to the motion so a character on it is carried
and a wall feels the push. Gravity, contacts, a loose host that would
fall: overridden every step, tested with an unlocked plank lifted 200px.
**Pausing Build puts every mover's object back at its start**
(`moverReturnAll`), so a paused level always shows things where they
were built and repeated pause/unpause cannot drift them.

## Walking while paused

The physics engine is not stepping while paused, so the player is moved by
hand in `freeMoveIfPaused`. Flying is the free-roam it always was. Not
flying is a real walk: gravity, ground, walls, small ledges stepped up, and
a jump. Each move is tried with `Body.translate` and backed out if
`Query.collides` finds it overlapping something solid — walls and
non-sensor object bodies, narrowed first with `Query.region`. Gravity is
applied in 4px steps so a fast fall still lands on the surface. Before
this, paused-and-not-flying slid sideways through everything and hung in
the air.

## The map is 19200 × 9600

Sixteen times the area it had (4800 × 2400 until 2026-09-11; Carson: "it
needs to be SO MUCH BIGGER"). Both dimensions are multiples of the water
cell. **A level file carries `worldW` / `worldH`; one without them was
built on the old map**, and `migrateWorldSize` puts it at the bottom-left
of this one on load: every world coordinate — objects (a v2 level's
dabs each), bolts, gadgets, link ends, checkpoints, bubbles, goal, spawn,
the flooded-world line — moves down by the difference in height; offsets
(a camera's zone and view, a mover's line, a glide) need nothing;
`unpackWaterSparse` decodes the painted water with the old map's column
count and moves its rows down. So an old level's ground is still the
ground and the new room is sky above and land to the right.

The water grid is nearly three million cells now, so nothing walks the
whole grid per frame or per snapshot: `stepWater` and `evictTrappedWater`
already worked in the box of cells with water in it (`wMinRow` …), and
now `packWaterSparse` (the level file) does too, and **a snapshot's water
is that box** (`packWaterBytes` → `{r0, c0, w, h, bytes}`) rather than a
byte per cell — undo takes a snapshot per edit, and a byte per cell would
have been 3MB each. `rebuildWaterSolid` still clears the whole `Uint8Array`
when there is water (a `fill(0)`, ~0.3ms). The water line and the dune
bank draw only across the screen.

**The suites are pinned to the old map.** Their scenes sit where the old
floor was and read `pos.y < 2300` and the like, so `mkprev.py` rewrites
the size line in the preview to read `pg_test_world_w/h` from storage
and `tenv.js` sets 4800 × 2400 unless `pg_test_real_world` is set — the
shipping file has no such switch. `regress.js` unpins for one section
and checks the real size and the migration.

## The map has edges

Three things kept the player inside the map before, and Carson still ended up
outside it. Now:

- **Walls are 240px thick, not 40.** Matter has no continuous collision, so
  anything moving faster than a wall is thick passes through it in one step —
  and a motor can fling the player that fast.
- **`keepInside(body)` runs every step** on the player and every object,
  static ones included since a locked thing can be dragged. Anything whose
  bounds poke past the edge is pushed back and stopped along that axis. Four
  comparisons per body.
- **Paint is clipped to the map** in both `addPolyToObject` and
  `newObjectFromPoly`, so nothing is ever built outside it.
- **The zoom floor keeps the view inside the map** on both axes, so zooming
  out never shows the void past the edge. `applyCamScale` raises
  `CAM_ZOOM_MIN` to whatever that takes. `CAM_ZOOM_MIN` itself is 0.04 —
the whole map can be on screen, if the screen allows — and zoomed out
past 0.45 the water draws as run rectangles only, no blobs and no
surface curve, since at that distance nothing of them shows.
- **Resize cannot make something that does not fit**, per axis.

## Resizing

Corner handles on the selection. The drag scales about the **opposite**
corner, so the one you are not holding stays put — that is what makes it feel
like pulling the shape bigger rather than watching it drift. Uniform only, as
LBP is; per-axis stretch is not offered.

`scaleObjectAbout` is the same shape of operation as `flipObjectAbout`:
pieces out to world, transform, `pgClean`, then `rebuildFromPieces` with a
zero frame because the geometry is already where it belongs.

Four things it has to respect, and all four are in the code for a reason:

- **Corner count does not change when you scale**, so the corner budget and
  the decomposition cost are not the problem here. Do not add guards for
  them.
- **`RESIZE_MIN_PX = 14`.** Below that the convex parts go degenerate and
  things start falling through each other.
- **`RESIZE_MAX_PX = 4200`.** Past that an object crosses the size where it
  stops being cached as a bitmap and gets slower to draw every frame.
- **Bolt anchors are positions ON the object**, so they have to move too.
  `carryBolts(list, mapPt)` handles it for resize and flip both — see
  **Bolts** for why the anchor maths is the way it is.

**The drag only previews.** Rebuilding geometry and physics on every mouse
move would be waste when the only thing that matters is where you let go, so
`drawResizePreview` draws a box and `commitResize` does the work.

## The personal menu

Sections across the top, pages inside each one. `MENU_SECTIONS_BUILD` is the
whole structure:

- **Select** — an action, not a page. It is a tool you pick up and use on the
  level, not something you read, so picking it selects the move tool and
  closes the menu.
- **Build** — what you make the world from. Materials, My Objects, My Creatures, My Projectiles, My Particles, Stickers.
- **Tools** — four pages, LBP2's own groupings (`TOOL_PAGES`): **Editing**
  (Move & Select, Erase, Vacuum — with the eraser's size when one is in
  hand), **Connectors** (the bolts, piston, rope), **Logic** (the sensors,
  button, lever, world changer), **Gameplay** (camera, mover, creature
  eye, start, checkpoint, bubble, goal). Carson wanted the editing tools
  in a different spot from the bolts and pistons. Erase and Vacuum came
  off the Materials page, which is materials only now. Picking a tool on
  a page other than Editing closes the menu, as Select does.
- **World** — the level itself.
- **Character** — Appearance, and Menu Colour.

Adding a page is one line in that table. A section with a single page hides
the page row, since the icon already said what it is.

**The number row is the editing tools.** `QUICK_TOOLS`: 1 Move & Select,
2 Erase, 3 Vacuum, and nothing else — Carson: "the bolts and stuff don't
need to be assigned to number keys, just editing tools". The chips wear
their numbers (`.keyTag`, `quickKeyFor`). 4–9 do nothing in Build; the
materials used to sit on 5–9. In Play 1–4 are still emotes.

**The gradient is a personal setting, not a level one.** Two colours and an
angle, written onto `#personalMenu` as `--pop-a`, `--pop-b` and `--pop-ang`,
so the stylesheet keeps ownership of how they are used and the JavaScript
never has to know the layout. Saved in `pg_menu_gradient` in localStorage
beside the character, never in the save file — it follows you between levels.

`renderInfoTab` is still defined but no longer reachable; the plan is a
tutorial mode instead. `MATERIAL_INFO` is its content and is kept for that.

**No LittleBigPlanet vocabulary in the interface.** The structure is modelled
on LBP2's, but the words are ordinary ones — Select, Build, Tools, World,
Character. Keep it that way in anything user-facing.

## Sliders

**Ranges are sized to what people do** — an emitter every 0.1–15s, each
copy living up to 30s, at most 20 alive and 50 in all, speeds to 1500
px/s, a timer to 60s, a fan 800 wide reaching 1500, reaches to 1000–2000
— so the usual value sits in the first half of the slider rather than
in its first few pixels (Carson: "most people will not have something
that emits every 10 minutes"). `addGadget`'s clamps stay wider, so an
older level with a bigger value still loads as it was.

**The menu holds still while a slider is worked.** The personal menu
follows the character's screen position every frame
(`updatePersonalMenuPos`), and the World page's Play-zoom preview moves
the camera while its slider is held, so the menu — and the slider — slid
out from under the cursor mid-drag: Carson's "really buggy and
glitchy". `pmHeld` (the pointer down inside the menu, cleared on the
window's pointerup) and `camEditHeld` / `worldPagePreviewWanted()` all
freeze the position.

Every slider in the game is built by `sliderRow`, so every one gets the
same three ways in: **drag** it; **click it and nudge** with the arrow
keys or A/D, a tenth of a notch at a time (a whole notch with Shift); or
**click the number and type** one. Enter or clicking away applies, Escape
puts it back, nonsense is ignored, out of range lands on the end.

Typed numbers are in the units on show — "45" on a percent slider is
45%, "20" on a motor is 20 rpm — and `sliderInverse` turns that back into
the raw value: every display here is monotonic in the value, so it
samples a notch at a time for the closest reading, bisects between the
neighbouring notches to land exactly, then takes the roundest number that
still reads the same (123 not 122.5, 0.45 not 0.4497). Ends that show
words — "loose", "night", "empty" — are skipped. Nothing about a
caller changed: `fmt` is still the only thing a slider knows about its
units.

The typed or nudged value is held in the row (`cur`), not read back from
the range input, which snaps whatever it is given to its notches; the
thumb sits on the nearest notch, the value is exact.

**A slider's `onChange` must not re-render the box it lives in.** The
rope length slider called `renderSelBar()` to refresh the "· 320px" line,
which replaced the slider under the cursor mid-drag and under the keys
mid-nudge; it updates that span in place now. The global key handlers
already ignore any focused `INPUT`, so A/D on a slider never walk the
player.

## The camera

**Build zooms on the cursor.** `zoomAround` (the wheel, Ctrl +/−) keeps the
world point under the cursor where it is — and lets go of the character to
do it (`camFollow = false`), since following would snap the view straight
back onto them and the cursor would mean nothing. The home button brings
it back. `buildZoom` is the editor's zoom, persisted as `pg_zoom`;
`applyCamScale` only writes it outside Play.

**Play has the level's own zoom and height.** `worldSettings.playZoom`
(World → Camera, with a "use the zoom I have now" button), applied on
entering Play and swapped back for `buildZoom` on leaving; the wheel does
nothing in Play (`zoomAround` returns). And `camHeight`, default −70:
the default camera aims that many px *above* the character (`playerAim`),
as LBP frames Sackboy — more level over the head than under the feet.
Every place the camera aims at the player uses `playerAim`: the default
follow, a gadget's tracking, the honest frame and its inverse. A level
saved with a zoom but no height loads centred (0), as it was built.

**The World page previews the default camera while its sliders are
worked.** `worldPagePreviewWanted`: Build, the World page open, and the
zoom or height row held (`camEditHeld`: pointerdown or focus on either
row, cleared on the window's pointerup / focusout) or changed within the
last 900ms (`camEditUntil`, bumped by `noteCamEdit` on every input). Then
the level shows the character at the Play zoom and height whatever the
editor camera was doing — detached, zoomed, anywhere — so the two sliders
are set by eye; let go and the editor's view comes back with the page
still open. It used to preview the whole time the page was open, which
Carson found got in the way of the rest of the page. `beginEditorHold` keeps the editor's zoom, follow flag and
centre in `edCam` (the same hold the walking preview uses, now with
follow and position too) and `endBuildPreview` puts all of it back when
the page closes. No easing here: a slider should answer at once.

**Camera gadgets** — LBP2's Game Camera, researched: a zone, a view (angle
and zoom), tracking ("how much it moves toward the player, or ignores
them"), and speed. Here: `kind:"camera"` in `gadgets[]`, placed on an
object like any gadget, hidden in Play by default. Settings in its box:
`zoom` (0.3–3), `tracking` (0 fixed on the view … 1 follows the player),
`speed` (0 slow … 1 instant). It takes an input (`canReceive`): **wired,
the signal decides and the zone is ignored** — my call, since a camera a
switch turns on for a far-off door is the useful case and a huge zone
covers the other; LBP2's own rule here was not findable. Unwired, the
zone decides. Several active at once: the one whose zone centre is
nearest wins (`activeCamera`).

**The zone is a box and the view is a frame, and both live where you put
them**, as LBP2's do — neither has to sit on the camera. `zone` is
`{dx, dy, w, h}` and `view` is `{dx, dy}`, offsets from the camera's own
spot in *world axes* (they ride with the host but do not turn with it);
`cameraZoneRect`, `cameraView`, `cameraFrameRect`. A radius in an older
save becomes a square zone. In Build a selected camera draws the blue zone
box and the gold frame at its zoom, each with corner handles, plus a
thread from the camera to where it looks and the glide's line, end frame
and knob. All of it drags straight, no host needed — a view can point at
sky: `cameraHandleAt` (frame corners, zone corners, the knob, then either
outline within a 7px band) feeds `attachDrag` kinds `camFrameCorner`,
`camZoneCorner`, `camEnd`, `camFrame`, `camZone`. A corner drag keeps the
opposite corner fixed, as object resize does; a frame corner sets the
zoom from the frame's width (the frame keeps the screen's shape) and
moves the view so the fixed corner stays. One undo step per drag, pushed
on the first real move, so a click that moves nothing leaves nothing. The
box has Width/Height sliders for the zone and "centre it on the camera"
buttons for both, and the Zoom slider is the frame's other handle. The
zone box also moves from **anywhere inside it** — as a second pass in
`beginDrag`, after gadgets, bolts and links have had their chance, so the
camera sitting in its own zone is still clickable.

**The gold frame is the truth, not the intent.** It draws at
`cameraShotRect`: the view pulled toward the player by tracking *for
where the player stands now*, then clamped to the map exactly as the Play
camera is. With tracking at 50% the frame sits halfway between the ⌖
view spot and the player and moves as they do; the test checks Play lands
on it to the pixel. Dragging the frame moves the *frame* by the cursor's
delta and puts the view spot wherever that requires (`cameraViewForShot`,
the inverse: at 100% tracking the view is irrelevant and is left alone).
Carson found the intent-only frame "not super accurate", which with
tracking at 50% it was not.

**A camera needs no host.** `gadgetNeedsHost(kind)` is false for cameras
only: placed on empty air it stays there (`obj: null`, `local: null`,
`gadgetWorld` falls back to `pos`) on the layer it was placed, saved with
`o: null`, dragged onto an object to ride it and back into the air to be
free again. Every other gadget still needs something to sit on.

**Build previews the shot.** Walking (not flying) into a zone in Build
shows what the camera will do — glide, hold, tracking, everything — as
LBP's create mode does. `buildPreviewWanted()`: Build, not flying, the
editor camera on the character (`camFollow`), and a camera active, easing
back, or triggered. `edCam` holds the editor's zoom for the duration and
`applyCamScale` does not persist while it is set, so the preview never
becomes the build zoom; `endBuildPreview` puts it back. Flying again
ends it at once (`setFlying`); landing resets the shot so it starts fresh;
walking out of the zone eases back to the editor view and then ends it;
the wheel takes over from a preview at the zoom it is showing, and a pan
ends it. Play and mode switches clear `edCam`.

`updatePlayCamera` runs from `updateCamera` in Play: target zoom is the
active camera's or `playZoom`; the target centre is the camera's spot
pulled toward the player by `tracking`; both ease at `0.03 + 0.27 *
speed` a frame while a camera is or was involved (`playCam.easing`), and
**snap exactly onto the character when none ever was** — every existing
test reads the camera as exact-follow, and levels without cameras play as
they always did. `resetPlayCamera` on entering Play. Zone membership is
read every frame off `gadgetWorld`, so a camera on a moving object moves
its zone with it.

**The Movie Camera tweaks**, from LBP2's real list (Transition type and
time, Track Player, Camera Shake, Hold Time with Infinite, Disable
Controllers — Flatness, Depth of Field and Skippable do not apply), on the
same gadget rather than a second kind:

- **Hold** — `holdMode`: `zone` (default) — the shot lasts while the
  player is in the zone or the signal is on, and hands back the moment
  they leave; `time` — the shot lasts `hold` seconds from when it starts
  whatever the player does, and **does not start again until the trigger
  has let go** (`playCam.spent` remembers the camera whose time ran out
  and clears when its trigger is off for a frame — otherwise standing in
  the zone would restart it every frame); `forever` — until another
  camera takes over. `holdForever` is still written for older readers.
  Carson: "how long it holds before going back to the player camera,
  unless the player wants to leave it so it continues until they leave".
  And `once`: one shot per play — `playCam.fired` collects a one-off
  camera the frame its shot ends and `activeCamera` skips it; cleared by
  `resetPlayCamera`, so every Play starts with all of them armed.
- **Move** — Carson wanted something easier than keyframes: `sweep`
  is one second spot (`dx, dy`, an offset from the camera in world axes,
  so it rides with the host), an end `zoom`, and `secs`. Each time the
  camera takes over (`playCam.t0`), the view glides from its spot to the
  second, smoothstepped, and stays there; tracking still pulls toward
  the player on top. In Build a selected camera draws the line, the end
  frame and a knob; the knob drags straight with `attachDrag` kind
  `camEnd` — no host needed, a view can point at sky — and the undo step
  is pushed at press since there is no snap-back. Two keys cover a pan
  or a push-in; more keys are more cameras, chained by zones or wires.
- **Shake** — `shake` 0–1, a random offset of up to 9 screen px a frame
  on the final camera position.
- **Freeze** — `freeze`: `cameraFreezesPlayer()` in the movement step
  drops walking and jumping while the shot is on. LBP's Disable
  Controllers.

Not done: **tilt**. A camera roll means a rotation in the frame transform
and its inverse in `screenToWorld`/`worldToScreen`, and the lighting
buffer and every screen-space overlay would need to agree; it is a
rendering change, not a camera setting, and is parked in the roadmap.

**Player settings** live in World too: `walkSpeed` (a multiplier, 25–300%),
`sprintSpeed` (100–300% *of walking*), `grabReach` (2–120px). `walkSpeedNow()`
and `grabReach()` read them with `worldNum`, which fills the default for a
level saved before the setting existed. `grabProbe` is rebuilt when the
reach changes. `WORLD_DEFAULTS` is the one list; `starterLevel` resets to
it (it used to leave gravity and light from the previous level);
`packWorldSettings` / `unpackPlayerSettings` are the save and both loads.
What is changed in Play is discarded with Play, like everything else.

**Test note:** never start a drag off the screen in a suite. Playwright
loses the button on a negative page coordinate and the *next* drag ends
after its first step — an hour of "why is this rect 1/6 the size".

## Frame times: F3

`showPerf`, F3: a readout in the corner — the frame's length averaged
(`perfAvg`), the worst frame of the last two seconds, the draw's own
time, physics steps this frame, running or paused, and what is on the
level. For when the game feels slow on a machine that is not this one.

## Layer peek

`layerPeek` (the 👁 Peek button in the layer pill, or V — `peek` in the
rebindable list): in Build, everything on a layer **in front of** the one
you are painting on draws at 0.18 alpha (`peekFade` inside `layerDepth`),
so you can see and work on what is behind it — LBP's peek. Building on
Back fades Mid and Front; on Mid, Front; on Front, nothing. Only the
alpha changes and the alpha is applied at the blit, so the bitmap cache
is untouched. Off in Play, and not saved. **And one thing at a time: hold the middle
button on an object** and that whole object is hidden while you hold —
any layer — drawn as a faint outline only (`peekObj`, set in the
canvas's pointerdown when the middle button lands on something,
cleared on the window's pointerup); on nothing, the middle button pans
as it always did. Carson: "press the middle mouse button down to hide
the specific object". The roadmap's "temporarily hide an object in a
layer".

## Play from here

`playFromHere()` (the "▶ Play here" button in the transport, or Ctrl+P):
Play, but starting where you are working — on a map this size the start
can be a long walk from the part being built. `playFrom` is the spot:
the character's own if it is on screen, else the middle of the view.
`setMode("play")` reads it once, after `respawnPlayer`, and puts the
character there (clamped inside the map, velocity zeroed, the 900ms
hazard grace); the start marker and the checkpoints are untouched, so a
death goes back to the real checkpoint. Plain Play is unchanged.

## Undo pauses

`undo()` pauses a running Build first (`setPaused(true)`): an undo is a
rewind, and what it brings back should stay put rather than fall, fire
or blow up again in the running world (Carson: "imagine I accidentally
place something that blows stuff up, and I need to rewind").

## The minimap

`#minimap`, a 240×120 canvas at the bottom-right of Build, hidden in
Play; M (`minimap` in the key table) toggles it, remembered in
`pg_minimap`. It frames the **level**, not the map: `minimapFit` takes
the bounds of every object, the water, the character and the view, pads
them 12%, holds the canvas's 2:1 shape, and clamps to no narrower than
`MINIMAP_MIN_W` (3200px) and no wider than the world — the whole
19200×9600 would squash any level into a few pixels of one corner.
Objects draw as a rectangle of their first piece's material colour
(Back and Front at half alpha), water as its bounding box, the character
as a dot in its colour, the view as a gold box, and the world's edge
dashed where it falls inside the frame. Redrawn at most twice a second
(`minimapAt`); it is a rough map, not a second view. A click looks
there — `camFollow` off, the view centred on the point read against
`minimapFrame`, the frame the last draw used. **The right button goes
there**: the character is put at the point (clamped inside the map,
velocity zeroed) and the camera follows them again. Carson's ask.

## Backgrounds

A drawn scene behind all three layers — the roadmap's "create and save
custom level backgrounds in a paint mode". Drawn in the studio as a
2:1 picture (`kind: "background"`, one state `scene`, the sky faint
under it as the backdrop; `openBackgroundDraft(entry)`), kept in **My
Backgrounds** (`mySkins.background`, `{ id, name, data: { art } }`, in
`pg_my_skins` with the rest) and chosen on **World → Background**
(`renderBackgroundTab`): the usual scenery, or any saved one, with Edit
and Forget; a plain colour to paint behind the picture instead of the
scenery (`bgPlain`, a hex or null — a cave, a room, a night); and
Distance (`bgSlide`, 0–1: how much of the camera's movement the picture
follows, shown inverted as "the sky … right behind").

**A level carries its own copy** — `worldSettings.bg = { id, name,
art }`, `useBackground(entry)` deep-copies the strokes — so a level is
whole on its own and forgetting a background from the device leaves any
level using it alone. Editing a saved one (`finishBackgroundDraft` with
`bgEntry`) re-copies it into the level if the level is using that id.
All three ride `WORLD_DEFAULTS`, so `packWorldSettings` writes them and
`unpackPlayerSettings` reads them back through `normalizeBg` (anything
that is not an object with a strokes array is no background), a colour
check and a clamp — a broken field loads as the usual scenery.

**Drawn full-resolution, over the scenery, under everything built**
(`drawLevelBackground`, from `drawBackground` after the half-res
scenery blit or the plain fill): the strokes rasterise once at
2048×1024 through `drawingCanvas`, and the picture is drawn the view's
height ×1.1 tall and twice that wide, its bottom on the bottom of the
view, sliding sideways by `bgSlide` of the camera's movement and
repeated across the width as mirrored copies so the join never shows;
climbing lifts it down a touch (`lift * 0.08 * k`, clamped so nothing
above it ever shows), as the scenery's horizon sinks. Two or three
`drawImage` calls a frame, GPU-scaled — not painted into the scenery
buffer, which is half-res and would soften the strokes.

## Music

The roadmap's "draw the music the way you draw materials", first cut.
`worldSettings.music` is `{ bpm, bars (1/2/4), vol, on, tracks }`,
four tracks — `lead` (triangle), `keys` (sine, longer), `bass`
(sawtooth two octaves down) and `drums` (kick, snare, hat, clap) —
each a list of `[step, row]` notes, sixteen steps a bar. The melodic
rows are `MUSIC_SEMIS`, a major pentatonic over two octaves from C4
(`musicFreq`), so any two notes drawn agree — the grid cannot be played
wrong. `normalizeMusic` clamps and de-duplicates a file's tune and
drops a step out of range; nonsense is no tune. In `WORLD_DEFAULTS`,
so the level file and snapshots carry it; `unpackPlayerSettings` stops
the player as it loads.

**The player** (`musicStart(source)` / `musicStop` / `musicTick`,
50ms): a scheduler on the real clock — `t0` is when the loop began,
every note within `MUSIC_AHEAD` (180ms) of now is handed to the synth
as an offset from `actx.currentTime` — so a suspended audio context
(no gesture yet, the suites) cannot stall the loop; `musicPlayer.step`
is the playhead. `musicVoice(track, row, at, vol, stepSec)` is the
voices, on `tone`/`noiseHit` with their `at`. `musicLog` keeps the
last 64 notes sent, for the suites. **In Play** it starts with the
mode when `on` and there are notes, and stops with it; the Music page's
"Play it" previews in Build (`source: "page"`) and closing the menu
stops that.

**The page** (World → Music, `renderMusicTab`): a track at a time on
an 800px canvas (`.musicGrid`, `drawMusicGrid`: bars marked, beats
shaded, the root's rows a touch darker, the other melodic tracks faint
underneath, the playhead while playing — redrawn each frame from
`drawFrame` while it plays); the left button paints a note (and sounds
it when nothing is playing), a drag paints a run, the right button
rubs out; bars, Clear this track, Tempo, Volume, "Plays in the level",
"Throw the tune away". A level with no tune shows one button, "Write a
tune". Not done: a music gadget (LBP2's sequencer as a thing on the
level), saving tunes to the device, more voices.

## Local players

Carson: "a level that can support 4 people, a platformer, where the
camera follows one person and the others get dragged along — I like the
Mario bubble mechanic". Up to `PLAYER_MAX` (4) characters on one
machine: the first is the keyboard and the first pad, as ever; each
further pad joins as its own character.

**Everything the character is lives in globals** — `player`, `input`,
`grounded`, the grab, the gun, the look, fifty-odd of them — read
directly by every system, hundreds of times over. Rather than thread a
player through all of that, each player is a **struct of those same
fields** (`makePlayerShell`, `FIELDS` is the list in `bindFrom` /
`unbindTo`) and exactly one is *bound* at a time: `bindFrom(P)` copies
its fields into the globals, `unbindTo(P)` copies them back, `me` is
the bound one and is `players[0]` whenever no player-loop is running.
`withPlayer(P, fn)` binds P round `fn` (and back, in a `finally`);
`forEachPlayer(fn)` does that for each in turn — with one player it is
a plain call and nothing moves. So a step or a draw written for "the
player" runs for every player: the movement step (`moveStep`), the
grounded step, `crushCheck`, the water's buoyancy, the fall line, the
paused walk (`freeMoveOne`, with `pausedVy`/`pausedGrounded` kept on
the struct), `drawPlayer`, `drawUsePrompt`, the launcher pickup, the
creature contact check. **Collision events bind the pair's own
player**: `groundContacts` and the hazard-touch `collisionStart` find
`playerOf(part)` and run `groundPair` / `touchPair` under `withPlayer`,
so each body's footing and each body's death are its own. The readers
that only want a position take **any or the nearest player**:
`eachPlayerBody(fn)` (bodies in the world — a bubbled one is not),
`anyPlayerWithin(pt, r)` (sensors, speech, the goal, bubbles,
checkpoints, a lever's prompt), `anyPlayer(fn)` (a button, which
needs the bound PW/PH), `nearestPlayer(pt)` (a creature's sight and
chase, the eye's look — stop distance from that player's size), the
fan, the destroyer's shove, `keepInside` and the speed cap. A pop
bounces the player who stomped (`creaturePop(g, by)`), not whoever is
first — a bullet's pop bounces nobody now. `isPlayerPart` knows every
player's parts. All players share `CARRY_GROUP`, so they walk through
each other, as what they carry does.

**Joining** (`pollGamepad`): a player keeps the pad they have (`P.pad`,
its slot in `getGamepads()`); the first player takes the first free
pad; a free pad — a toast says how, once per pad (`padHinted`) — whose
Start or A is pressed joins (`addPlayer`): a fresh shell with the first
player's size, its own colour from `CHAR_COLORS`, the plain look,
`padPrev` marked so the press that joined is not a jump and does not
open the pause menu, spawned beside the first. A pad unplugged lets go
of its player, who takes it back when it returns (a free pad goes first
to a player who lost theirs); one gone `PAD_GONE_MS` (4s) leaves
(`removePlayer`, never the first). Then each player reads their own pad
(`pollPad`, the old body of `pollGamepad`); the keyboard is the first
player's only. A pad player carries toward the right stick, else ahead
(`carryAimPoint`). The "Controller connected" toast is the first
player's; a joiner gets "Player 2 joined!".

**The camera follows the first player** (`playerAim` on the bound
globals, outside any loop = `players[0]`), and **one left behind goes
into a bubble** (`bubbleStep`, each frame in Play with several
players): further from the first than half the screen plus
`BUBBLE_MARGIN` — measured from the first player, not the camera rect,
so a camera shot looking elsewhere does not bubble everyone beside
them — for `BUBBLE_AFTER_STEPS` frames, `bubbleUp`: the body out of the
world (`World.remove`), `P.bubble = {x, y}` clamped onto the screen,
drawn by `drawBubbledPlayer` (the character at 0.55 in a bubble); it
floats to above the first player's head at `BUBBLE_SPEED` px/frame
(`BUBBLE_HURRY` with jump held) and pops within 26px after half a
second (`popBubble` → `unbubble`: the body back in the world there,
with the respawn grace). **Dying is a bubble too** for a player who is
not the first, in Play (`playerDied`: the death still counts, then
`bubbleUp` instead of the checkpoint); the first player respawns as
ever, and out of lives or time's up respawns everyone
(`respawnAllPlayers`). Play from here drops everyone at the spot; a
level's character size applies to all; leaving Play `gatherPlayers`
the rest beside the first, bubbles popped. Snapshots carry the first
player only (the others are gathered on the way back). Still to come:
Versus (several starts, per-player knockouts), the camera that frames
everyone, emotes and the launcher HUD for pad players.

`mkprev.py` rewrites the `getGamepads` line to read `window.__pgFakePads`
(a list) or `window.__pgFakePad`; `players()`, `fakePads`, `addPlayer`,
`removePlayer`, `playerTo2`, `bubble` in the hook. `tplayers.js`.

## A controller

`pollGamepad()`, at the top of every
frame (the Gamepad API has no events for sticks): the first connected
pad drives the character beside the keyboard — the left stick or the
pad walks (up and down fly and swim, as the keys do), A jumps (through
`handleJumpOrFlyToggle`, so a double-tap flies in Build), X or B grabs,
Y is the interact key (doors and levers), the bumpers sprint, Start
opens and closes the pause menu; with a launcher in hand the right
stick aims (`gunAim`, a crosshair drawn by `drawCursorOverlay` on the
stick's direction, 260px out) and the right trigger fires. **Held keys
and held buttons add up**: the keyboard's own flags are `keyHeld`, the
pad's `padHeld`, and `syncPadInput` ORs them into `input`, so a key let
go does not cancel a stick, nor the other way round; the grab is set
from either. A pad unplugged clears what it held. A toast the first time
one is seen. `mkprev.py` rewrites the `getGamepads` line so a suite can
plant `window.__pgFakePad` — an object shaped like a Gamepad — and the
shipping file never reads it.

## Level types

Carson: "different level types … there will need to be settings for all
of that; when setting up a level, getting to choose the level type".
`LEVEL_TYPES` — **Adventure** (start to finish), **Versus** (players
against each other: lives, knockouts, a fall line), **Minigame** (a
quick round for many: a clock, a score), **Hub** (a place to be in — My
World is one, any level can be), and **Top-down (2.5D)**, listed as
coming and not pickable (`soon`), so the idea is not forgotten. Each
says which rules it shows (`lives`, `time`, `fall`, `knockouts`).
`worldSettings.levelType` with `lives`, `timeLimit`, `fallLine`,
`knockouts` ride `WORLD_DEFAULTS`, are clamped by
`unpackPlayerSettings` (a `soon` type loads as an adventure), and a
file from before with `hub: true` loads as a hub. Versus and Minigame
are for several players, which do not exist yet: their rules are kept
with the level now so a level built today plays right when they can
join; the page says so.

**Chosen when a level is made** — `askLevelType` (`#typeOverlay`, the
cards from `renderLevelTypeCards`; "Just an adventure" is the way out)
in `doNew`, after the confirm — and changed on **World → Level**, the
section's first page (`renderLevelTypeTab`: the cards, then the rules
that apply). `menu(section, page)` in the hook takes a page for the
suites that want World Settings.

**The rules in Play** (`playRun`: lives left, deaths, the clock's
start, `over`; `startPlayRun` with Play). Every death — a zap, a bite,
a squash, the void below the map, the fall line — goes through
`playerDied(msg)`: in Play, not in a hub, it counts; with lives on, a
life goes, and the last gone starts the run over from the start with
the lives back. `runRules()` each frame: the clock (`runTimeLeft`), and
at nought the run starts over (an adventure back to the start, a
minigame with its score named); the **fall line** (`fallLine`, a y in
world px, set from the page — under the character, or a slider up from
the bottom — and drawn as a red dashed line across the map in Build) is
a death when crossed. The HUD: `#livesHud` (❤ n) and `#timeHud` (⏱
m:ss, red under ten seconds) beside the score, shown only when the
level counts them (`updateRunHud`, touching the DOM only on change).
In Build a death is a plain respawn, as it was.

## My World and level doors

The roadmap's shell, first cut, opt-in — the game still boots into the
last level as it did. **My World** is a level of your own on this
device: `pg_myworld_id` names its local record, its file carries `hub:
true` (`levelIsHub`, set by `loadLevelData`, written by
`serializeLevel`, cleared by `doNew`). The header's **🏠 My World**
button (`openMyWorld`) loads it — making a starter one, named and saved
locally, the first time — and enters Play, since it is walked around
in; Build is a click away and edits it like any level. The button lights
while the hub is open.

**A level door** (`kind:"door"`, Gameplay, host-less like the launcher):
`leadsTo` `{ local: id }` or `{ cloud: id }` — **not `target`, which is
a timer's and a counter's number**; packing a door's object under that
name broke every timer on load — `targetName`, `label` (the sign over
the arch; the target's name when blank). The level's own picture shows
through the arch (`doorPicture`, the local record's thumbnail as an
Image kept on the door). Its box lists the
device's other levels to lead to, **✨ Make a new level for this door**
— which saves a fresh starter level locally and points the door at it,
round-tripping the current level through `serializeLevel`/`loadLevelData`
and finding the door again by its spot, since the reload renumbers
gadgets — and "Leads nowhere". Drawn 2.4× the size of a gadget glyph so
it can be walked into.

**Through and back** (`enterDoor` / `leaveDoor`, `doorVisit`): in Play,
a door with a target is what the interact key finds (`leverNearPlayer`
counts it; the prompt reads "enter <name>"). Entering: `levelRecordById`
fetches the target (a local record, or the cloud document's payload),
then Build first (Play's snapshot puts the world back), the current
level's file, ids, name and the door's spot kept in `doorVisit` (an
`outer` chain for a door inside a visited level), the target loaded,
its ids made current (so a save goes there), Play. Leaving — the goal
reached (`levelComplete`, after 1.4s) or the pause menu's "Leave this
level" — is the same the other way, `playFrom` set to the door so Play
starts there. `autosaveNow` does nothing while visiting: what is
running is not what is being built. A target that is gone says so and
stays put. A **🚪 Leave** pill sits in the Play HUD while visiting.

**A level's character size** — the roadmap's "small, medium or large
characters only": `worldSettings.charSize` (null, or a scale; World →
Player: Any / Small 1 / Medium 2 / Big 3). Entering Play with one set
holds the player's own scale in `playScaleHold` and calls
`setCharScale(size, true)` — `forLevel` keeps it out of
`pg_char_scale`, since the level's size is the level's, not the
player's choice — and leaving Play puts the player's own back.

## Tips

The tutorial mode the roadmap asked for, as LBP does it: a short card
the first time you try something, and never again for that thing.
`TIPS` is the table — keyed `welcome`, `play`, `select`, `box`,
`studio`, `tool:<id>` for every tool and gadget, `mode:<paintMode>` for
the shapes and the fill; materials come from `MATERIAL_INFO` with the
material's label as the title. `tipWatch`, run once a frame after the
HUD, looks at what changed — the tool (`matBase(currentTool)`, so a
tint is the same material), the paint mode while a material is in hand,
the mode, a first selection, the box opening, the studio opening — and
`offerTip(id)`. One card at a time (`#tipCard`, bottom centre): while
one is up, the next is queued behind it, at most three deep, so a burst
of tool changes cannot pile up a lecture. Shown means seen
(`pg_tips_seen`); the card goes by itself after `TIP_MS` (16s), on Got
it, or when the next comes. "No more tips" on the card and the Tips
row in Settings set `pg_tips`; "Show them all again" clears the seen
list and the watch's memory (`resetTips`) so the welcome comes round
again. `tipWatch` reads state one frame late on purpose: every path
that picks a tool — the menu, the number row, Alt-click, a wizard
closing — is covered without touching any of them.

**The suites run with tips off.** `tenv.js` sets `pg_tips` to `0` in
its init script (unless `pg_test_tips` is set): a card over the bottom
of the canvas would eat a suite's clicks and drags. `tui.js` turns them
on itself through the hooks.

## The hover label

`#hoverLayer`, a whisper under the layer pill: "on **Back**" / **Mid** /
**Front** for whatever the Select cursor is over, gone when it is over
nothing. Refreshed from `hoverObj` every frame in `updateHoverLayer`, which
only touches the DOM when the text actually changes.

## The transforms as keys

The object box's Turn & flip and Layer buttons have keys, all rebindable
in Settings (`KEY_ACTIONS`): **Z** / **X** turn the selection 15° left /
right, **H** flips it, and **Shift+[** / **Shift+]** move it a layer back
/ forward — the same keys that move the *brush's* layer without Shift.
They act only in Build with something selected, so plain Z with nothing
selected is nothing (Ctrl+Z is still undo, handled before). The buttons'
tooltips name the keys through `bindLabel`. The roadmap's "transforms as
keybinds".

## Selection follows the shape

The selection and hover outlines stroke the object's own regions
(`objectPaths(o).regions[i].path` in the body's frame, `shapeOutline` in
`drawSelectionOutline`), not the bounds rectangle — a diagonal plank's
box is mostly air, and Carson wanted the box gone. The four corner
knobs stay, as the resize handles. **The marquee picks by material**:
an object is in the rubber band if any of its pieces intersects the
band's rectangle (`pgIntersects`, after a cheap bounds test), so a band
round two dots inside a diagonal plank's box picks the dots and not the
plank. Carson: "only the specific material touching inside the box".

## Glue

LBP's glue, both halves. **Same layer**: the two are welded into one
object (`mergeObjects`, the CSG weld — the tool's only behaviour
before). **Different layers**: they cannot be one body, since only Mid
has physics, so they become a **glue group** — `o.glue`, a shared id
(`glueTogether`; a weld keeps whichever group either was in) — and each
keeps its own layer and shape. A group is one thing to the cursor:
`selectObject` selects `glueMates(o)`, `selectMany` and
`toggleInSelection` expand through `glueExpand`, `beginDrag` takes
`selList()` after selecting, so the group moves, turns, flips, copies
(each copy set shares a fresh id) and deletes as one; `removeObject`
unglues what it removes. **A Mid thing glued to Back or Front scenery is
held still** (`gluedToScenery`, folded into `refreshObjectPhysics`'s
static test — the scenery has no physics to carry it, and LBP holds a
thing glued to something static); its box says "Held by the glue"
instead of the lock. `packObject` writes `glue`, `unpackObject` reads
it, so the level file and snapshots carry it; the box's **Unglue this**
frees one (a group of one is no group). Glue is a tool on the Editing
page (`currentTool === "glue"`, sticky until Esc or another tool) and
still Tab held. Carson: "it pulled the thing from the back into the
front layer instead of making them two glued objects in separate
layers". **Mates follow whatever drives one of them**: `glueFollow`, an
`afterUpdate` step, carries every mate that did not move itself by the
shift and turn of one that did (`_glueLast`, where each glued thing was
last step) — so a mover or a stiff piston on the Mid thing takes the
scenery glued to it along, while a dragged group, whose members all
moved, is left alone.

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

**Detach** is the complement of region-delete: same removal, but the polygon
is handed to `newObjectFromPoly` as a fresh object instead of thrown away.
The new object is born exactly where the piece was, sitting in the socket it
left, and physics takes it from there — which is what LBP's unglue does. On
the selection bar and the right-click menu, under the same "a real piece of
something bigger" condition as the scissors.

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

**A level's picture.** A save takes one — what is on screen, drawn as a
clean frame (`cleanShot` makes `drawFrame` skip the selection ring, the
brush ring, the previews and the readouts, and return before the HUD),
copied cover-fit into a 192×108 canvas and kept as a JPEG data URL,
`thumb`, about 8KB. `levelThumb` never throws: a canvas that will not
read hands back the last picture. The cloud record carries `thumb` as
its own field beside `payload` so the load list never parses a level
to show it. `lastThumb` — set by a save and by `loadLevelData` — rides
along in every other serialize, so the autosave and a restore keep the
picture the level had. The list shows it in `.lthumb`, a blank block
for a level from before this; only a string beginning `data:image/`
is ever put in a `url()`.

**The device's room.** localStorage is about 5MB on most browsers and
a level is 100–300KB, so thirty of them do not fit — and a `setItem`
that does not fit *throws*, which used to abort a save with no word to
anyone (the throw landed inside the cloud promise) and made the autosave
timer throw every fifteen seconds. `storeSet(key, str)` never throws:
true if it went in, false if not. `saveLocalLevel` returns whether the
level is on the device: the list is written newest first, thirty at
most, and when it does not fit the *oldest levels other than this one*
go, one at a time, until it does — said out loud in a toast, with the
count — and only a level that cannot fit on its own is refused, the
list untouched. `doSave` words its toast by that result, and so does
the cloud fallback. The autosave says once per session that it no
longer fits (`autosaveNoRoom`) and keeps trying; `persistSavedObjects`
says so too. The load list ends with what the device holds
(`storageUsed()`, UTF-16 so two bytes a character, "of about 5MB").
The real fix is IndexedDB, which has no such limit — a change of store
with a migration, for a quieter day.

**Two tabs, one autosave.** Every open tab of the game wrote `pg_autosave`
every 15 seconds, so an older tab left open in the background kept
writing its stale copy of the level over the one being worked on, and the
next reload came up with whichever tab had written last — Carson's "did
you revert way back to an old save?" (nothing had been reverted; a
second tab had been opened for him after every batch). `autosaveNow`:
`autosaveSeen` is the stamp of the last autosave this tab loaded at boot
or wrote; a newer stamp in storage means another tab is writing, and
while that tab is alive — its write within `AUTOSAVE_OTHER_MS` (90s,
since a background tab's timer is throttled to once a minute) — this one
stands back and says so, once; a tab quiet for longer is closed, and this
one takes over and says that too. The Save button always writes.

## Known hazards

- 🔴 **`geom.js` is duplicated.** The standalone file and the copy inlined in
  the HTML are kept in sync by hand. `node checkgeom.js` catches drift (it
  ignores line endings: git's autocrlf hands one file CRLF and a Python
  rewrite leaves the other LF); a real build step would retire the problem.
  Until then, edit one and copy it over.
- 🟠 **Autosave writes ~140KB synchronously every 15 seconds.**
- 🟠 Levels have no owner or thumbnail. They *do* now have an id — see
  **Saving** — but nothing ties one to a person.
- 🟠 Characters, My Objects and the drawn things are localStorage-only — and so are local levels, which is why the device fills up (see **Saving**, "The device's room"). IndexedDB is the fix.
- 🟠 900KB in one file is well past the edge of comfortable. A split into src files with a build step is the fix, and would retire the geom.js hazard with it.

## What's next

**[`ROADMAP.md`](ROADMAP.md) is the full picture** — Carson's direction for the
whole project, captured 2026-09-10 and sorted by what each part depends on.
Read it before planning anything larger than a bug fix.

The short version. Near-term, cheap and self-contained: the fill tool, a 4x
larger world, and the water/ice polish. Bolts and region-delete are done. Then the
LBP gadget family — buttons, levers, player and water sensors, emitters, mover,
world changer, creature eye — none of which exists yet, and which is the
biggest jump in what a level can actually do.

Also still wanted from the earlier list: custom drawn materials (the save
schema already reserves `u:<id>` keys — needs a drawing surface, property
sliders, naming, and embedding into levels) and layer peek. Sprint on Shift
is done.

The floppy swingable rope is **superseded, and the grab is built**: hold
Shift or the right mouse button while touching sponge. Ropes as level
objects are a separate, built thing — see Links.

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
