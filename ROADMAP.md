# Planet Genesis — the roadmap

Carson's direction for the project, captured 2026-09-10. This is the goal the
work aims at; `CLAUDE.md` is how the code currently works. Nothing here is
built yet unless it says so.

Sorted by **what it depends on**, not by how much Carson wants it — because
roughly half this list needs a backend that does not exist, and the other half
does not. The parts that need nothing new should not wait on the parts that
need everything.

---

## The shape of the whole thing

Planet Genesis becomes LittleBigPlanet: a creative sandbox wrapped in a social
platform. A persistent customisable hub world, a full gadget family so levels
can actually *do* things, several more creation surfaces (creatures, music,
backgrounds, particles, animated objects), and then an online layer — publish
levels, find other people's, play together, trade, and sell what you make for
in-game currency.

The reference is always **actual LBP behaviour**, researched rather than
approximated.

---

## Part A — Fixes and polish to what already exists

No new architecture. These are things wrong or missing in systems already
built, and they are the cheapest wins in the document.

### Bolts — DONE

Carson flagged bolts twice, independently. Current problems:

- Cannot be visually placed on the front-most layer.
- Cannot really be locked onto the back layer.
- Need to work in **build mode when unpaused**.
- **Motor bolts should not be loose** — only loose bolts should be loose.
- Speed adjustment moves **out of world settings** and onto the bolt:
  right-click a bolt for its own menu. Carson explicitly does not want this in
  the global menu.

Reworked 2026-09-10, then reworked again the same day after Carson pointed
out the layer behaviour was backwards: a bolt goes THROUGH the layers, as in
LBP. Now: bolts join a Mid thing to the Back or Front behind or in front of
it; four kinds as four tools (Bolt, Sprung, Motor, Wobble) with LBP1/2's own
settings in the object box; a ghost of the bolt at the cursor, green when it
has a pair and red when not; motors drive about the pivot and run in Build
when unpaused. See the Bolts section of `CLAUDE.md`. Covered by `tbolt.js`.

**Open question for Carson:** a cart with wheels needs both parts physical in
different layers, which is how LBP does it. Here Front and Back are
decoration with no physics. Should Front/Back objects be able to be physical?

**Deferred:** the wobble bolt's *flipper* mode (swing on a trigger, return on
release) needs the sensor/switch family from Part B.

### The map has edges — DONE

Carson wound up outside the map. Fixed 2026-09-10: thick walls, a per-step
backstop that pushes anything back in, paint clipped to the map, a zoom floor
that never shows past the edge, and resize that cannot make something that
does not fit.

### Delete should remove the region, not the object — DONE

Selecting an object and pressing Delete currently removes the whole thing.
Carson's example: a line of sponge drawn through a big wooden circle. Delete
should remove **only the sponge region** — which today is only possible via the
cut feature.

To delete the whole object: double-click, or click-and-drag to select all of it.

Built. Del acts on the piece you clicked; double-click or rubber-band takes
the whole object. Covered by `tsel.js`.

### Other polish

- **Water material** needs work and polish. 2026-09-11: thin water dries up, a pool draws as one calm surface, a Vacuum tool takes water only, the eraser works by layer; then 8px cells and splashes. More to come.
- **Ice must get slipperier on a slope.** DONE 2026-09-11 — ice is skated on: the keys accelerate rather than set your speed, letting go coasts, and a slope takes you down it.
- **Level size at least 4x larger** than now — as large as possible. DONE 2026-09-11 — 19200 × 9600, sixteen times the area. Old levels land at the bottom-left of the new map with the new room above and to the right.
- **Replace "rope grab" with a proper LBP-style grab.** DONE — see below.
- **Temporarily hide an object in a layer**, the way LBP does. DONE 2026-09-11 — hold the middle button on a thing and it is hidden while you hold.
- **Double jump toggle** in world settings. DONE 2026-09-11 — World → Player, saved with the level.
- **Inventory and popit menu** should match LBP's menus as closely as possible,
  functionally and visually.

Carried over from the earlier near-term list in `CLAUDE.md`, still wanted:

- **Layer peek** — related to, but not the same as, temporarily hiding an
  object in a layer. DONE 2026-09-11 — 👁 Peek in the layer pill, or V: the layers in front of the one you are painting on go faint. Hiding one object is still to do.
- **Sprint on shift.** DONE — a bit quicker, not a dash.

### The grab (supersedes the floppy rope) — DONE

Built 2026-09-10: hold the right mouse button (or Q) while touching
sponge and your hands close on it. Swing from a hanging one, drag a heavy
loose one, pick up a light loose one and carry it wherever the cursor
points, catch one mid-air; only letting go of the button lets go. Any object can be
made grabbable from its box. Sponge within reach glows
while the key is held. Covered by `tgrab.js`.

Decided 2026-09-10. **The floppy swingable rope is not a player mechanic.**
Carson dropped it in favour of doing LBP's grab properly:

> "I'd prefer the player to be able to just grab, and make the mechanic as
> similar to LBP as possible, but with computer controls in mind rather than
> controller."

So: the player grabs grabbable material and swings from it, the way LBP does —
that *is* the swinging mechanic, rather than a separate rope item. The design
work is in the **input mapping**, since LBP's grab is a held shoulder button
(R1) and this is keyboard and mouse. A held key with a clear visual affordance
for what is grabbable, and swing physics that feel like LBP's, are the two
things to get right.

Whether ropes remain as *level objects* is untouched by this — only the player
mechanic changed.

### The build UI rework — LBP2, in progress

**Stage 1 done (2026-09-10):** the menu is rebuilt on LBP2's structure —
sections across the top, pages inside each — and a gradient you choose
yourself under Character > Menu Colour, with eight presets, both colours and
an angle. Covered by `tmenu.js`.

**The structure is LBP2's; the words are not.** Carson: drop the LBP
vocabulary. Select, Build, Tools, World, Character — no popit, no goodies, no
costume. Applies to anything user-facing from here on.

**Stage 2 done (2026-09-10):** resize, via corner handles on the selection.
Grab, move, duplicate and delete were already there.

**Stage 3 done (2026-09-10):** detach — the piece you clicked becomes its
own object, born in the socket it left. Select now has every power LBP's
cursor has.

**Stage 4 done (2026-09-10):** the floating selection bar and the right-click
popup are gone, replaced by one object box docked on the right — movable,
resizable, remembered. Carson: "just one object settings box that pops up on
the right, like LBP; similarly bolts and other things will have a menu like
this." Covered by `tctx.js`.

**Still to do:** sub-categories inside Materials. Transforms as keybinds DONE 2026-09-11 — Z / X turn, H flips, Shift+[ / Shift+] move the selection a layer; all rebindable.
The bolt rework and every gadget put their settings in the same box.

### The build UI rework — original note

Decided 2026-09-10. Three connected changes to how you handle a thing you have
selected.

**Kill the floating selection bar.** The strip of buttons that appears next to
a selected object goes away. Its problem is that it follows the object and
covers what you are working on.

**One panel on the right instead.** Right-click opens a box down the right-hand
side holding everything about the selected thing in one place — material,
layer, physics state, and the actions that are not keybinds. **Adjustable in
size and position.** This is closer to LBP's popit than a floating toolbar is.

**Transforms become keybinds.** Rotate, flip and layer move to the keyboard
rather than buttons. The rebindable-controls system already exists, so they
should go through it rather than being hardcoded.

### Resize what you have made — DONE

Carson: "the ability to resize the stuff you make like LBP would be super
important too."

Grab a selected object and scale it, the way LBP does. `pgScale` already
exists in the geometry core, and scaling moves corners without adding any, so
the geometry and the corner budget are not the hard part.

Built 2026-09-10: corner handles on the selection, scaling about the opposite
corner, uniform only. Covered by `tsel.js`. All four of the things below were
handled — see the Resizing section of `CLAUDE.md`.

The parts that needed thought:

- **A minimum size.** Scaled far enough down, convex physics parts go
  degenerate and collision gets unreliable.
- **Bolts attached to a scaled object.** Their anchor points are positions on
  the object and have to scale with it, or joints drift off the thing they
  were pinned to.
- **The bitmap cache.** Corner count does not change but drawn size does, so a
  big scale-up can cross the threshold where an object is too large to cache.
- **Uniform or free.** LBP scales uniformly from a corner handle by default.
  Worth matching before offering per-axis stretch.

### Fill tool — DONE 2026-09-11

A bucket, inside material paint mode. Draw a weird closed outline in wood, fill
the interior with any material. The boolean geometry already supports this; it
needs the tool and the flood-region logic.

Built: "Fill" in the Draw with row. Click inside anything closed all the way
round by material on your layer and the inside fills — with the material, or
with water. Hover shows what a click would fill. An island inside is left
alone; a gap in the outline, or the map's edge, means nothing is enclosed.

---

## Part B — The LBP gadget family

Self-contained, offline, and the biggest single jump in what levels can *be*.
Nothing here needs a backend.

**Started 2026-09-10.** Player sensor, button and lever exist, with wires
that drive motor and wobble bolts. The signal system — `gadgets[]`, `wires[]`,
an output per gadget and an input per receiver — is what the rest of the
family plugs into. Pistons and rope followed the same day: two-click
connectors between any two objects, the piston with LBP's full settings and
three wired modes, the rope hanging from a one-sided tether. `emitter` in the
code is still a material flag meaning "emits light", not a gadget.

Carson's instruction for the whole family: research the real LBP system and
implement it, including connected systems, rather than approximating.

| gadget | behaviour |
| --- | --- |
| **Player sensors** | DONE. Radius; on while the player is inside it. |
| **Buttons** (stepped on) | DONE. Sticky option. |
| **Levers** (interact key) | DONE. F to flip; springs-back option. |
| **Water sensors** | DONE 2026-09-11. On while the sensor itself is under water, as LBP's. |
| **Pistons** | DONE. Shortest/longest, seconds per stroke, pause, stiff, wired in/out/run. |
| **Rope** | DONE. Length; hangs, swings, goes slack, holds. |
| **Emitters** | Research the LBP emitter system specifically — it is deeper than it looks. |
| **World changer** | DONE 2026-09-11. Wired to any activator; moves the world's light and/or water level to its values over a time, back when the signal stops, or stays changed. |
| **Mover** | DONE 2026-09-11, to the spec below. |
| **Emitters** | DONE 2026-09-12. The Object emitter fires copies of a saved object: every so often, each living a while, so many at once, flung at a speed and angle; wired, a stream or one per signal. |
| **Tags, tag sensors** | DONE 2026-09-12, LBP2's: a colour and label; a sensor hears its colour within reach, on/off or by closeness. |
| **Impact sensors** | DONE 2026-09-12: a pulse on a hit or on while touching; the player only; a tag required. |
| **Projectiles** | DONE 2026-09-12: the Launcher powerup (bullets, a drawn projectile, a saved object, a ray), drawn projectiles with hitboxes in My Projectiles, emitters firing them, the projectile sensor. |
| **Save tabs** | DONE 2026-09-12: My Creatures, My Projectiles, My Particles, drawn objects on My Objects — placed ready-made. |
| **Timers, counters** | DONE 2026-09-12, LBP2's: up / up-and-down / down, a target, a reset wire; a counter of rising edges with a reset. |
| **Creature eye** | DONE 2026-09-11, to the spec below. |
| **Camera** | DONE 2026-09-11. LBP2's Game Camera: zone, zoom, tracking, speed; wired, the switch decides. Plus the Movie Camera's hold time (or hold for good), shake, controls off, and a glide to a second spot and zoom — Carson's "easier than keyframing". Play has its own fixed zoom, set in World. **Still to do: tilt** (a camera roll; a rendering change — the frame transform, its inverse for the mouse, the light buffer and overlays all have to agree). |

### Mover — DONE

Built 2026-09-11 as specified: click the object, click where it goes; once
or bounce; speed; wired or not; green one-way line, orange two-way; the
player rides it. `tmover.js`.

Place it on an object. Placing opens a mode where you draw a line; the object
follows that line and stops at the end.

- Default look: an **arrow**.
- Two modes: travel once and stop, or **bounce back and forth**.
- The bounce line is **orange with an arrow on both ends** — visually distinct
  from the one-way green line.
- Adjustable speed.
- Can be activated by a player sensor or other tools.

### Creature eye — DONE

Built 2026-09-11: the eye follows you; the creature chases you left and
right, or floating anywhere; speed and sight are settings; it dies when you
land on the eye, unless told not to. `tcreature.js`.

Drop it onto an object you built and the object becomes a creature.

- The eye visibly follows the player.
- The object follows the player on the **left/right axis only** by default.
- Toggle **all directions** and it floats toward the player freely.
- Adjustable speed and other creature properties.
- Toggle: **"creature dies when stepped on"** — yes/no.

Carson explicitly grants liberty on the details here: make it feel like LBP.

### Gadget visibility — DONE

Every bolt and gadget has "Visible in Play". Hidden ones still work.

---

## Part C — New creation surfaces

Each is a new authoring mode. They share a pattern already proven twice in this
codebase (the character creator, the level editor): **draw it, name it, save
it, reuse it.**

### Custom drawn materials — DONE 2026-09-12

Built: Build → Materials → My Materials → New. Draw one square tile in the studio, name it, and it is a material: the tile repeats across whatever you paint, turning with the object. Its own grip, bounce, weight, tile size, grabbable, deadly, floats — changing them changes what is already built. Saved inside any level that uses it, so it travels with the level.

(The original note:)

Carried over from the earlier near-term list, and the closest thing to a
started feature: **the save schema already reserves `u:<id>` keys.** Needs a
drawing surface, property sliders, naming, and embedding into levels so a
level carries its own custom materials.

### Create a creature — DONE 2026-09-11

Draw and animate a creature the way you draw and animate a character. Simple or
animated. Adjustable hitbox. Save custom creatures. Carries the same settings as
the creature eye ("dies when stepped on", etc).

Built: a Creature eye's box opens the studio for it — Idle, Moving, and an
Action a wire plays — drawn over the creature's painted body, which stays the
hitbox. My Creatures saves them. The studio itself was rebuilt for all of this
(undo/redo, an artist's tools, 48 frames, playback); the rig mode is gone.

### Animated object — DONE 2026-09-11

Draw an animated object with either a **custom hand-drawn hitbox** or **no
collision at all**.

Built: the Animated object gadget. Paint the object in the shape you want the
hitbox to be, draw the look over it (Idle loops; a wire plays Action, looping
or once-and-hold), or set it to no collision.

### Rollercoaster — first cut DONE 2026-09-12

Built as written: the Coaster track tool (Tools → Gameplay) draws a grey
line through anything; the coaster waits at its start, F sits you in, it
runs the line (faster downhill, never slower than its pace) and stops at
the end; Space hops off and it glides back for the next run. One to
twelve seats, coupled by their place along the rail rather than
simulated, so they never stretch or pile up; a seat of your own drawing
on every car; each player their own seat. Still to do: moving a drawn
track, loops that keep the seats upright, a wire that sends it, a
customised look for the track itself.

A track **material**, not a gadget:

- **Fixed brush size** — deliberately not adjustable. Grey.
- Creates track wherever you draw the line.
- **Passes through all blocks** — geometry does not stop the coaster.
- The coaster **stops at the end of the line you drew.**
- Default coaster is **one seat**; up to **12**, edited by right-clicking the
  front seat.
- Right-clicking the front seat also offers **customise coaster look**: draw
  your own seat within a bounded range above the track, and the design
  **duplicates across all rear seats**.
- Spacing and coupling must actually work. Think through the pitfalls of this
  system before building it — Carson called this out specifically.

### Music creation — first cut DONE 2026-09-12

A simple music tab where you **draw the music the way you draw materials.**
Piano, drums, guitar, bass. Built as World → Music: a grid a track at a time
(lead, keys, bass, drums), painted with the mouse, every note in tune with
every other; tempo, one to four bars, plays while the level is played, saved
with it. Still to come: a music gadget on the level (a tune that starts when
you reach it), tunes kept on the device, more instruments.

### Backgrounds — DONE 2026-09-12

Create and save custom level backgrounds in a paint mode. Eventually sellable.
Drawn in the studio as a wide picture, kept in My Backgrounds, chosen on
World → Background with a plain colour or the usual scenery behind it and a
Distance for how much it moves with the level. A level carries its own copy.

### Stickers — DONE 2026-09-11

LBP's stickers, but drawn: Build → Stickers, draw one, click to stick a copy on
anything — any layer, or the background — where it rides with the thing and is
trimmed to its shape. Size, turn, flip; picked by its picture; My Stickers keeps
them on this device.

### Custom particles — DONE 2026-09-11

Author your own particle effects.

Built: the Particles gadget — draw the particle (several frames play over its
life), then rate, speed, direction, spread, gravity, life, size, spin; wired,
it emits while the signal is on.

### Character improvements

- **Crouch**, animatable for custom characters. DONE 2026-09-11 — Down on the ground; the hitbox squashes to three fifths, you fit under low things, you stand when there is room. A Crouch pose in the creator.
- **Slide** — crouch while running to slide a little. Animatable. DONE 2026-09-11 — Down at a run; half a second of slide with the keys off. A Slide pose in the creator.
- **Custom hand-drawn hitboxes** for characters, potentially **size-changing**
  so a crouch can have a shorter box. DONE 2026-09-11 for the standing
  character: the studio goes Size → look → Hitbox, the size is any height
  from half the old to three and a half times (twice by default, shown to
  scale on a bit of level next to a 100px crate), and the hitbox is drawn.
  A crouch's shorter box waits on the crouch.

### 2.5D create mode — first cut DONE 2026-09-12 (a level type, "Top-down")

A whole second mode:

- Top-down view. WASD moves up/down/left/right.
- The character **looks at the cursor**.
- Same material editing and geometry as the side-on mode.
- Needs its own character creation and animation options that make sense for a
  top-down view.

---

## Part D — The shell: hub world, menus, level plumbing

The frame the game lives in. Mostly offline; the menu tabs that need a backend
are marked.

### Main menu

Tabs:

- **My World** — see below.
- **Level Finder** — needs backend.
- **Friends** — needs backend.
- **Shop** — needs backend.

A **Loot Boxes** tab was in the original list and is parked; see "Parked" at
the end. Leave room for it in the menu layout rather than designing it out.

### My World — first cut DONE 2026-09-12

A persistent, customisable hub where all your level creation lives. Built
opt-in: the 🏠 My World button in the header opens it (makes it the first
time), a level of your own on the device, flagged as the hub, entered in
Play; Build edits it like any level. No main-menu screen yet — the game
still boots into the last level.

- Like a level, but **no start and no finish.**
- You walk around in it.
- Customisable through a **paintbrush-style customiser**, the same way
  characters and levels are.

### Level types — the framework DONE 2026-09-12

Carson, 2026-09-12: "I'm hoping for different level types! A level that can
only really support 4 people easily, a platformer a-b classic, where the
camera follows one person and the others get dragged along — I like the
Mario bubble mechanic. Or a minigame where you could have a ton of players,
all with guns trying to shoot each other. Remember my 2.5D idea. Or a level
where people can chill, a hub. When setting up a level getting to choose the
level type. A smash-bros style minigame where 4 people fight — lots of
settings."

Built: the kind is chosen when a level is made and on World → Level —
Adventure, Versus, Minigame, Hub, and Top-down listed as coming — with the
rules each kind shows: lives, a time limit, a fall line, knockouts to win.
Lives, the clock and the fall line work now for one player; Versus and
Minigame keep their rules so they play right when players can join.

**Still to do, in order** — see Part E for what needs a backend:

1. **Local players first.** DONE 2026-09-12 — several characters on one
   machine: the keyboard and the first pad are player one, every further
   pad joins with Start as its own character (up to four), each with
   their own grab, gun and footing; sensors, buttons, creatures, the fan,
   the goal and the crush see all of them; a second player on the same
   keyboard (U joins, I J K L walk, O grabs, Y uses). Not yet: emotes and
   the launcher's ammo readout for pad players.
2. **The camera for a group**: DONE 2026-09-12 for the platformer — the
   camera follows player one, and a player left off the screen (or who
   dies) goes into a bubble that floats back to them and pops (Carson's
   Mario mechanic; jump hurries it). The camera that frames everyone: DONE
   2026-09-12, in Versus and Minigame levels.
3. **Versus rules**: DONE 2026-09-12 — each player's own knockouts and
   lives, a launcher's shot a knockout for the shooter, the last one
   standing or the first to the count named the winner and a new round;
   players collide with each other now (one can stand on the other's
   head, as in LBP); a Minigame counts each player's own score and names
   the top scorer at time's up; every flag is a start (put down
   checkpoints and each player begins at their own). Not yet: melee.
4. **Online**: rooms, joining, the level sent to everyone — Part E.
5. **Top-down (2.5D)**: DONE 2026-09-12 as a level type — gravity off,
   the arrows walk every way, no jump, the character looks at the cursor
   (a pad's right stick), loose things slide and stop, water a still
   pool, creatures chase every way, a ground seen from above. Not yet: a
   character rig drawn for the top-down view (the side-on drawing is
   turned), a dash.

### Level doors — first cut DONE 2026-09-12

In the inventory's **Tools tab**, a **"level door"**. Built: the Level door
tool on the Gameplay page; its box picks a level on the device or makes a
new one for it; in Play, F at the door goes in, finishing the level or the
pause menu's Leave (or the 🚪 pill) comes back to the door; the level's
picture shows through the arch; a level can set the character's size
(World → Player). Still to do: the door's own look, cloud levels in the
picker.

- Place it in My World, then right-click for options including **"create
  level"**.
- Creating a level makes a door appear for it.
- Before entering, choose level options — **"small, medium or large characters
  only?"** and other pertinent creation settings. All toggleable later.
  Superseded 2026-09-12 by **level characters** (Carson): a level says who
  players can be — their own, one character of the author's that everyone
  must use, or a pick from the author's list (one each, or the same allowed).
  DONE: World → Level → Characters; the level carries copies; a picker at
  the start of Play (mouse, keys, or a pad). Also done the same day: a
  character can come armed with a launcher of its own (Character →
  Launcher); a hitbox drawn for the crouch; Swim and In-water poses.
- Customising the door's own appearance comes later.

### Tutorial mode — DONE 2026-09-12 (as tips)

Decided 2026-09-10, replacing the always-on hint strip and the tagline under
the header, both now removed. Carson: "later we can add in a tutorial mode
that slowly shows you stuff and gives tips."

Teaching happens on a curve rather than as a permanent wall of text across the
top of the screen. Built as **tips**: a short card the first time you pick up
a tool, a material, a gadget, enter Play, select something, open the box or
the studio — and never again for that thing. Off with one click on the card
or in Settings, and "Show them all again" starts over. A guided walkthrough
(a first level that teaches step by step) would sit on top of this and is
still open.

### More of the gadget family — DONE 2026-09-12

- **Speech bubble** — a line above whatever it sits on, spoken while the
  player is near or while wired on; once per Play if you like.
- **Destroyer** — wired: the thing it sits on is gone the moment the signal
  comes on, with a bang that shoves what is near, or quietly. Play only.
- **Sound** — wired: one of sixteen level sounds when the signal comes on,
  pitch and volume, again every so often while on.
- **Gate** — AND, OR, XOR, NOT and a toggle, in one chip.
- **A saved object keeps its logic** — the gadgets on it and the wires among
  them, so placing, emitting or firing it gives you the whole thing: an
  emitter that spawns drawn creatures.

### Carson's list of 2026-09-12 — DONE the same day

Fixes: slider ranges sized to what people do; the Mover's second click (any
tool, and the box can start the choosing again); the Play-zoom slider no
longer slides out from under the cursor; lights glow in daylight, reach with
their size, light the shape at night, show while painted, and a **Spotlight**
tool shines a cone; custom projectiles are a look, an Impact drawing and a
hitbox — how they fly is set on the launcher or emitter; the emitter's box
starts with what kind of thing it fires (object, bullet, projectile, ray);
the projectile sensor fires on every Nth hit, for a named projectile, in a
box round it or on painted spots, and can destroy its host.

Additions: Ctrl+Z pauses Build first; **Rockets**; the **Missile** (a hole
in soft material, a scorch on metal); things flung or spun too hard come
apart, and nothing outruns the walls; the character is squashed between two
things or inside one, in Play and in a running Build; the map's right button
puts the character there.

### Editor conveniences — DONE 2026-09-12

- **Play from here** — Play starting where you are working, not at the
  level's start (the button beside Play, or Ctrl+P). The start marker is
  untouched; a death still goes back to the real checkpoint.
- **The minimap** — the whole level in the corner of Build, the view a box
  on it, a click to look there. M hides it.
- **Level pictures** — a save takes a picture of what is on screen and the
  load list shows it.

### Portals — DONE 2026-09-12 as level doors

String levels together — walk through a portal to arrive in another level, like
LBP. The use case Carson named: one level too big for a single world, split
into parts. The Level door does this: put one down, pick the level it leads
to, F goes in and finishing it (or Leave) comes back to the door.

---

## Part E — The online platform

**Everything here needs a backend that does not exist yet.** Today levels have
no owner, no id and no thumbnail; saves go to a `db` capability or
localStorage; characters and My Objects are localStorage-only. See the hazards
in `CLAUDE.md` and the storage section of `teardown.html`.

Not a reason to skip it — a reason to build the account and storage layer once,
deliberately, before the features that assume it.

### Level Finder

Reference the LBP online system throughout.

- Search bar.
- Popular levels displayed.
- **Difficulty voting 1–10, available after beating the level.**
- **Like / dislike, available after merely playing** — you do not have to beat
  it.
- Submit your own levels for review.

### Moderation

Level submissions and store submissions are **reviewed by Carson** for
appropriateness before going live.

### Friends and social

- Friends list.
- **Email-style messaging system.**
- **Chat box, bottom left.**
- **Invite friends to help you build a level.**
- **Invite friends to play a level with you.**

### Multiplayer

Host servers. Multiple people playing at once. Ideally **massive lobbies or
play sessions.**

### Currency

**Coins.** Purchasable **only with real money**, in the shop — deliberately, to
create scarcity and demand.

### Trading

- Trade **character skins and objects** with other people.
- Offer coins for them.

(Card trading is parked along with loot boxes — see below.)

### The store

People sell what they make, priced in coins they set themselves:

- Objects, music, characters, backgrounds, levels, creatures.
- Submissions **reviewed by Carson**.
- Buyers must be able to **test a character before buying** and see its possible
  animations.
- Listings must state **whether the character is animated or not.**

---

## Things to decide before Part E is built

Flagged because they change the architecture, not because they are objections.

1. **Selling coins for real money to a young audience carries obligations**
   even without loot boxes — refunds, parental consent in some places, and
   clear pricing. Much lighter than the randomised-reward case, but it is the
   reason the currency should be designed as a normal storefront purchase
   rather than something reachable by accident mid-game.
2. **Manual review by one person does not scale.** Completely right for the
   first few hundred submissions, the bottleneck after that. Worth designing
   the queue so other reviewers can be added without a rewrite.
3. **Multiplayer is the single largest technical item here.** Matter.js is not
   deterministic across machines, so synchronised physics needs either an
   authoritative host or state reconciliation. This decision shapes the netcode
   and should not be made late.
4. **Selling user-made content means handling other people's money** — payouts,
   chargebacks, tax. Worth knowing whether sellers cash out or whether coins
   stay inside the economy.
5. **The three open questions from `teardown.html`** are still unanswered and
   gate the ordering of this whole document: how far away is "other people play
   this"; is this staying an Artifact or becoming a real site; enemies before
   or after publishing.

---

## Suggested order

Carson's call, but this is the dependency-honest reading:

1. **Part A** — cheap, self-contained, makes what people already use feel
   better. Bolts and region-delete first.
2. **Part B** — the gadget family. Biggest gameplay return per unit of work,
   needs no new infrastructure, turns static scenes into levels.
3. **Parts C and D** — more to create, and somewhere to keep it.
4. **The storage and account layer** — built once, deliberately.
5. **Part E** — on top of that layer.

Enemies (Part B's creature eye plus creature creation) landing before publishing
matches the instinct already recorded in `teardown.html`: a discovery page full
of empty levels is worse than no discovery page.

---

## Parked

Not cancelled — set aside, with the reasoning kept so the decision does not
have to be made twice.

### Loot boxes and trading cards

Parked 2026-09-10. Carson: "no need to think about loot boxes right now."

The original design: boxes bought with coins, containing custom trading cards
with Pokémon-style rarity tiers, drawn by Carson, needing an authoring path for
him to draw and add them to the pool. Card trading was part of the same system.

**Currency and the store are not parked** — Carson's read is that "a currency
and store where people can share stuff is smart," and that part stands on its
own. It is only the randomised-reward layer that is set aside.

Worth knowing if it comes back: paid loot boxes are banned outright in some
countries and require odds disclosure in others, with the rules tightest
exactly where the audience skews young. That is a design constraint to plan
around from the start, not a bolt-on.

### The floppy swingable rope

Superseded 2026-09-10 by the LBP-style grab — see Part A. Not a player
mechanic any more.

---

## Already noted as done or partly done

Carson's note: "some of these have been added already." Verified against the
code at capture time — bolts, checkpoints, water, glass, light with real
shadows, rope/grapple, particles, three depth layers, the material system with
28 colours, and the character creator all exist. The gadget family, creature
system, music, backgrounds, rollercoaster, portals, crouch/slide, fill tool,
2.5D mode and the entire online platform do not.
