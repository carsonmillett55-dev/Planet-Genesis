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
| `planet-genesis.html` | **The game.** ~590KB, the source of truth, what gets published. |
| `geom.js` | The polygon geometry core. Also inlined verbatim inside the HTML — see the hazard below. |
| `pc.min.js`, `earcut.min.js`, `matter.min.js` | Vendored libraries, kept for the test harness and for re-inlining. |
| `mkprev.py` | Builds `preview.html`: swaps the Matter CDN for the local copy, strips web fonts, appends the `window.__pg` test hook. |
| `regress.js` `tsel.js` `tlayer.js` `tmat.js` `tlight.js` `tctx.js` `tmenu.js` `tbolt.js` `tgadget.js` `tlink.js` `tgrab.js` `tjump.js` `tcam.js` `tmover.js` `tworld.js` `tcreature.js` | Playwright suites, 550 checks between them. |
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
npm test                   # all 550 checks + checkgeom, in order
npm run perf               # migration and frame time on level.json
```

Or one suite at a time:

```
node regress.js            # 35 — geometry, save/load, play mode, loop and save safety, map edges
node tsel.js               # 39 — selection, marquee, group transforms, resize, detach
node tlayer.js             # 12 — layer accuracy, ranked picking, the hover label
node tmat.js               # 17 — materials, colours, glass, light
node tlight.js             # 20 — lighting, shadows, glow
node tctx.js               # 24 — the object box: opening, closing, moving, remembering
node tmenu.js              # 19 — the personal menu's sections, pages and gradient
node tbolt.js              # 56 — bolts: through the layers, four kinds, limits, the box, the ghost, moving, typed rpm, painting onto a bolted wall, save/load
node tgadget.js            # 49 — player sensor, button, lever, wires, what they drive, moving, paused walking
node tlink.js              # 59 — pistons and rope: placing, cycling, stiff, wired modes, hanging, resize, moving, save/load, the slider's field and keys
node tgrab.js              # 62 — grabbing: by key or mouse, swinging and its cap, dragging, carrying on the ring, loads, no riding, no clipping; sprint; the weight slider
node tjump.js              # 10 — the jump: no wall climbing, grace off a ledge, a press just before landing
node tmover.js             # 22 — the Mover: two-click placing, once and bounce, riding it, a loose host held, wired, the knob, save/load
node tworld.js             # 18 — the Water sensor, and the World changer's light and water, wired, latched, saved
node tcreature.js          # 17 — the Creature eye: chasing, stopping short, sight, locked, flying, the stomp, save/load
node tcam.js               # 91 — Play's own zoom and height, the World page's live preview, zooming on the cursor, Camera gadgets (zone box, view frame, dragging both, the honest frame, mid-air cameras, wired, three holds, glide, shake, freeze, the Build preview), walking and sprinting pace, grab reach
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
| **watersensor** | the sensor itself is under water (`waterAt(pos) > 0.5`), the world's or painted — LBP's | — |
| **changer** | while wired on (unwired: always; `latch`: for good once it has been), the world's light and/or water level move to its values over `secs` — see The live world | setLight, light, setWater, water, secs, latch |
| **eye** | its host is a creature — see Creatures | range, speed, fly, deadly |
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
both static, nothing to do.

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

**The eye is the weak spot** (`deadly`, on by default): landing on it —
`groundBody` is the host, the feet within the eye's width of it and just
above — pops the creature (`creatureStompCheck`: particles, the delete
sound, a small bounce, `removeObject`). **Play only**: in Build a stomp
would take the object with it for real, and Play's snapshot brings it
back. It does not hurt the player by itself: the box says to paint the
rest of it in a hazard if it should.

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

## Sliders

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

**The World page previews the default camera live.** While the personal
menu is open on the World section in Build (`worldPagePreviewWanted`),
the level shows the character at the Play zoom and height whatever the
editor camera was doing — detached, zoomed, anywhere — so the two sliders
are set by eye. `beginEditorHold` keeps the editor's zoom, follow flag and
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

## The hover label

`#hoverLayer`, a whisper under the layer pill: "on **Back**" / **Mid** /
**Front** for whatever the Select cursor is over, gone when it is over
nothing. Refreshed from `hoverObj` every frame in `updateHoverLayer`, which
only touches the DOM when the text actually changes.

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
  the HTML are kept in sync by hand. `node checkgeom.js` catches drift (it
  ignores line endings: git's autocrlf hands one file CRLF and a Python
  rewrite leaves the other LF); a real build step would retire the problem.
  Until then, edit one and copy it over.
- 🟠 **Autosave writes ~140KB synchronously every 15 seconds.**
- 🟠 Levels have no owner or thumbnail. They *do* now have an id — see
  **Saving** — but nothing ties one to a person.
- 🟠 Characters and My Objects are localStorage-only.
- 🟠 590KB in one file is past the edge of comfortable. A split into src files with a build step is the fix, and would retire the geom.js hazard with it.

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
