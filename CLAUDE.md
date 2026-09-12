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
| `regress.js` `tsel.js` `tlayer.js` `tmat.js` `tlight.js` `tctx.js` `tmenu.js` `tbolt.js` `tgadget.js` `tlink.js` `tgrab.js` `tjump.js` `tcam.js` `tmover.js` `tworld.js` `tcreature.js` `twater.js` `tstudio.js` `tskins.js` `tfill.js` | Playwright suites, 759 checks between them. |
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
npm test                   # all 759 checks + checkgeom, in order
npm run perf               # migration and frame time on level.json
```

Or one suite at a time:

```
node regress.js            # 39 — geometry, save/load, play mode, loop and save safety, two tabs and the autosave, map edges
node tsel.js               # 38 — selection, marquee, group transforms, resize, detach, the number row
node tlayer.js             # 17 — layer accuracy, ranked picking, the hover label, peek
node tmat.js               # 17 — materials, colours, glass, light
node tlight.js             # 20 — lighting, shadows, glow
node tctx.js               # 24 — the object box: opening, closing, moving, remembering
node tmenu.js              # 31 — the personal menu's sections, the Tools bag's four pages, the number keys, the gradient
node tbolt.js              # 57 — bolts: through the layers, four kinds, limits, the box, the ghost, moving, typed rpm, painting onto a bolted wall, save/load
node tgadget.js            # 49 — player sensor, button, lever, wires, what they drive, moving, paused walking
node tlink.js              # 60 — pistons and rope: placing, cycling, stiff, wired modes, hanging, resize, moving, save/load, the slider's field and keys
node tgrab.js              # 62 — grabbing: by key or mouse, swinging and its cap, dragging, carrying on the ring, loads, no riding, no clipping; sprint; the weight slider
node tjump.js              # 18 — the jump: no wall climbing, grace off a ledge, a press just before landing; ice is skated on; the double jump setting
node tmover.js             # 22 — the Mover: two-click placing, once and bounce, riding it, a loose host held, wired, the knob, save/load
node tworld.js             # 22 — the Water sensor (touching, not a pool above; on Front), and the World changer's light and water, wired, latched, saved
node tcreature.js          # 32 — the Creature eye: chasing, stopping short, sight, locked, flying, the stomp, painted weak spot and danger, colour, a Back-layer creature, save/load
node twater.js             # 15 — the eraser by layer, the vacuum, water drying up and a pool staying
node tstudio.js            # 61 — the studio: strokes, undo/redo, the tools, frames, playback, no rig; the brush ring, filled shapes, nudge and flip, the Settings card's keys; the character's size and drawn hitbox
node tfill.js              # 14 — the fill: a closed outline fills with material or water; open space, material, a gap and an island
node tskins.js             # 69 — the Custom creature and Custom object wizards (size, look, hitbox, weak spot, danger), a fresh one held still with no collision until its hitbox is drawn, undo on a step, the marker in the hitbox's middle and moving the whole thing, placing in a drag-out shape mode, the old body names, death and attack animations, facing, no-collision, particles with pictures and their opacity
node tcam.js               # 92 — Play's own zoom and height, the World page's live preview, zooming on the cursor, Camera gadgets (zone box, view frame, dragging both, the honest frame, mid-air cameras, wired, three holds, glide, shake, freeze, the Build preview), walking and sprinting pace, grab reach
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
the layer's id, `geomRev`, rounded position and angle — so hovering
does not redo it unless something changed; the cursor overlay shows the
space a click would fill, lit in the material's colour, recomputed at
most every 120ms.

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

## Layer peek

`layerPeek` (the 👁 Peek button in the layer pill, or V — `peek` in the
rebindable list): in Build, everything on a layer **in front of** the one
you are painting on draws at 0.18 alpha (`peekFade` inside `layerDepth`),
so you can see and work on what is behind it — LBP's peek. Building on
Back fades Mid and Front; on Mid, Front; on Front, nothing. Only the
alpha changes and the alpha is applied at the blit, so the bitmap cache
is untouched. Off in Play, and not saved. From the roadmap's "temporarily
hide an object in a layer" / "layer peek"; hiding a single object is not
done.

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
