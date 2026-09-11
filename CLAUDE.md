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
| `regress.js` `tsel.js` `tlayer.js` `tmat.js` `tlight.js` `tctx.js` `tmenu.js` `tbolt.js` `tgadget.js` `tlink.js` | Playwright suites, 284 checks between them. |
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
npm test                   # all 284 checks + checkgeom, in order
npm run perf               # migration and frame time on level.json
```

Or one suite at a time:

```
node regress.js            # 35 — geometry, save/load, play mode, loop and save safety, map edges
node tsel.js               # 39 — selection, marquee, group transforms, resize, detach
node tlayer.js             # 9  — layer accuracy and ranked picking
node tmat.js               # 17 — materials, colours, glass, light
node tlight.js             # 20 — lighting, shadows, glow
node tctx.js               # 24 — the object box: opening, closing, moving, remembering
node tmenu.js              # 19 — the personal menu's sections, pages and gradient
node tbolt.js              # 46 — bolts: through the layers, four kinds, limits, the box, the ghost, save/load
node tgadget.js            # 43 — player sensor, button, lever, wires, what they drive, paused walking
node tlink.js              # 32 — pistons and rope: placing, cycling, stiff, wired modes, hanging, save/load
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
point on the build layer and the object under it one layer behind (or, if
nothing is behind, one in front); the bolt takes the front-most layer of the
two so it draws on top.

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

What takes an input today (`canReceive`): a **motor bolt** — the signal is
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

**Stiff is a rigid linkage, not a damping.** A single distance constraint
cannot hold an angle at all — the rod swung to vertical under any load, 209px
of droop either way, measured. `setPistonStiff` adds two constraints: `c2`
parallel to the rod, `STIFF_OFF` px to one side in each body's frame (with
the first, a parallelogram, which keeps the far body's orientation), and `c3`
diagonal from A1 to B2 (which stops the parallelogram shearing). Two
triangles: rigid in every way but the length, and all three lengths are kept
in step each frame. 4px of droop after.

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

`relinkAfterRebuild` re-points every constraint of a link at a host's new
body after a rebuild and re-derives the anchor from where it was;
`carryLinks` maps anchors through resize and flip. Removing a host removes
its links. Saves and snapshots carry links by object index, and wires can
point at a piston (`toLink`).

Also fixed on the way: `collisionActive` counted any overlap with the player
as ground, sensors included — a rope, a Back-layer decoration, a walk-through
light would have let you jump in mid-air. Only a solid counts now.

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
  `CAM_ZOOM_MIN` to whatever that takes.
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
- **Build** — what you make the world from. Materials, My Objects.
- **Tools** — what you make behaviour from. Functions today; the roadmap's
  gadget family, music and backgrounds land here.
- **World** — the level itself.
- **Character** — Appearance, and Menu Colour.

Adding a page is one line in that table. A section with a single page hides
the page row, since the icon already said what it is.

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

The short version. Near-term, cheap and self-contained: the fill tool, a 4x
larger world, and the water/ice polish. Bolts and region-delete are done. Then the
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
