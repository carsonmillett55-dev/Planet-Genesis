/* Grabbing, the LBP way: hold grab while touching grabbable material and
   your hands close on it. Swing from a hanging sponge, drag a loose one,
   let go and jump.  node tgrab.js */
const { launch, previewURL } = require('./tenv');
let pass=0, fail=0;
const ok=(n,c,e)=>{ if(c){pass++;console.log('  ok  '+n);} else {fail++;console.log('  FAIL '+n+(e!==undefined?'  -> '+JSON.stringify(e):''));} };
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport:{width:1280,height:760} });
  const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
  p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await p.goto(previewURL);
  await p.waitForTimeout(1100);
  await p.evaluate(() => { window.__pg.freezeCam(); window.__pg.setStick(false); window.__pg.setPaintMode('rect'); });
  const cam = await p.evaluate(() => window.__pg.cam());
  const X = cam.x + 400, Y = cam.y + 300;
  const w2p = (x,y) => p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [x,y]);
  async function rect(mat, layer, x0, y0, x1, y1){
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const grabbing = () => p.evaluate(() => window.__pg.grabbing());
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const stats = () => p.evaluate(() => window.__pg.stats());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(false); });
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };

  console.log('');
  console.log('== hold grab while touching sponge ==');
  await fresh();
  await rect('wood', 1, X-200, Y+100, X+300, Y+140);       // floor
  await rect('sponge', 1, X, Y, X+80, Y+100);              // a sponge block on it
  await lockAll();
  await play();
  await standAt(X-22, Y+60);                               // right beside the sponge, touching
  ok('nothing is held before the key', !(await grabbing()));
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('holding Q beside sponge grabs it', await grabbing());
  await p.keyboard.up('KeyQ'); await p.waitForTimeout(200);
  ok('letting go lets go', !(await grabbing()));
  await standAt(X-300, Y+60);                              // nowhere near it
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('holding Q with nothing grabbable in reach grabs nothing', !(await grabbing()));
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== only grabbable material ==');
  await fresh();
  await rect('wood', 1, X-200, Y+100, X+300, Y+140);
  await rect('wood', 1, X, Y, X+80, Y+100);                // a wood block, same spot
  await lockAll();
  await play();
  await standAt(X-22, Y+60);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('wood cannot be grabbed', !(await grabbing()));
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== the right mouse button grabs too ==');
  await fresh();
  await rect('wood', 1, X-200, Y+100, X+300, Y+140);
  await rect('sponge', 1, X, Y, X+80, Y+100);
  await lockAll();
  await play();
  await standAt(X-22, Y+60);
  const away = await w2p(X+400, Y-200);
  await p.mouse.move(away.x, away.y);                      // pointing nowhere in particular: no aiming
  await p.mouse.down({ button:'right' }); await p.waitForTimeout(250);
  ok('right mouse held grabs, wherever the mouse points', await grabbing());
  await p.mouse.up({ button:'right' }); await p.waitForTimeout(200);
  ok('and releasing it lets go', !(await grabbing()));

  console.log('');
  console.log('== swinging from a sponge on a rope ==');
  await fresh();
  await rect('wood', 1, X, Y-140, X+80, Y-60);             // a locked beam up high (below the HUD)
  await lockAll();
  await rect('sponge', 1, X+20, Y+80, X+60, Y+140);        // a small sponge hanging below it
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('rope'); });
  await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [X+40, Y-100]);
  await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [X+40, Y+110]);
  await play();
  await p.waitForTimeout(600);                             // let the sponge settle on its rope
  const sp = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0];
  ok('the sponge hangs from the rope', !!sp && sp.pos.y > Y-80 && sp.pos.y < Y+260, sp && sp.pos);
  // drop the player in beside it, grabbing on the way past
  await p.keyboard.down('KeyQ');
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [sp.pos.x - 34, sp.pos.y - 60]);
  await p.waitForTimeout(500);
  ok('grabbing in mid-air catches it', await grabbing());
  const hang0 = await pos();
  await p.waitForTimeout(1200);
  const hang1 = await pos();
  ok('you hang from it rather than falling to the floor', hang1.y < Y+300, { y: hang1.y, floor: 2330 });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(600); await p.keyboard.up('KeyD');
  await p.waitForTimeout(300);
  const hang2 = await pos();
  ok('pushing sideways swings you', Math.abs(hang2.x - hang1.x) > 15, { from: hang1.x, to: hang2.x });
  await p.keyboard.press('Space'); await p.waitForTimeout(200);
  ok('Space does not break the grab', await grabbing());
  await p.keyboard.up('KeyQ'); await p.waitForTimeout(200);
  ok('only letting go does', !(await grabbing()));

  console.log('');
  console.log('== dragging a loose sponge ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+400, Y+140);
  await lockAll();
  await rect('sponge', 1, X, Y+20, X+70, Y+100);            // loose sponge on the floor
  await play();
  await standAt(X-24, Y+60);
  await p.waitForTimeout(400);
  const bx0 = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0].pos.x;
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('grabbed the loose sponge', await grabbing());
  await p.keyboard.down('KeyA'); await p.waitForTimeout(900); await p.keyboard.up('KeyA');
  await p.keyboard.up('KeyQ'); await p.waitForTimeout(200);
  const bx1 = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0].pos.x;
  ok('walking away drags it along', bx1 < bx0 - 20, { from: bx0, to: bx1 });

  console.log('');
  console.log('== the grip survives the object being rebuilt ==');
  await fresh();
  await rect('wood', 1, X-200, Y+100, X+300, Y+140);
  await rect('sponge', 1, X, Y, X+80, Y+100);
  await lockAll();
  await p.evaluate(() => { window.__pg.paused(false); });
  await standAt(X-22, Y+60);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('grabbed it in Build with the world running', await grabbing());
  await p.evaluate(() => { window.__pg.setTool('move'); const o = window.__pg.objects().find(q => q.pieces[0].m === 'sponge'); window.__pg.select(o); window.__pg.flip(); });
  await p.waitForTimeout(300);
  ok('flipping the sponge under your hands keeps the grip', await grabbing());
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== sprint on Shift ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+600, Y+140);
  await lockAll();
  await play();
  await standAt(X-300, Y+60); await p.waitForTimeout(300);
  const w0 = await pos();
  await p.keyboard.down('KeyD'); await p.waitForTimeout(800); await p.keyboard.up('KeyD');
  await p.waitForTimeout(150);
  const walked = (await pos()).x - w0.x;
  await standAt(X-300, Y+60); await p.waitForTimeout(300);
  const s0 = await pos();
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyD'); await p.waitForTimeout(800); await p.keyboard.up('KeyD'); await p.keyboard.up('ShiftLeft');
  await p.waitForTimeout(150);
  const sprinted = (await pos()).x - s0.x;
  console.log('   walked', walked.toFixed(0) + 'px, sprinted', sprinted.toFixed(0) + 'px in the same time');
  ok('holding Shift is quicker', sprinted > walked * 1.25, { walked, sprinted });
  ok('but only a bit — not a dash', sprinted < walked * 1.8, { walked, sprinted });

  console.log('');
  console.log('== a light sponge is picked up and follows the cursor ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+400, Y+140);
  await lockAll();
  await rect('sponge', 1, X, Y+60, X+40, Y+100);            // a little 40x40 piece
  await play();
  await standAt(X-22, Y+60); await p.waitForTimeout(300);
  const lil = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0];
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('it is carried, not pinned', (await p.evaluate(() => window.__pg.carrying())) === lil.id, await p.evaluate(() => window.__pg.carrying()));
  const up = await w2p(X+40, Y-60);                          // cursor up and to the right of the player
  await p.mouse.move(up.x, up.y); await p.waitForTimeout(700);
  const lifted = (await stats()).filter(o => o.id === lil.id)[0];
  const pl = await pos();
  console.log('   sponge at', Math.round(lifted.pos.x), Math.round(lifted.pos.y), ' player at', Math.round(pl.x), Math.round(pl.y));
  ok('it rises toward the cursor', lifted.pos.y < pl.y - 30, { sponge: lifted.pos.y, player: pl.y });
  ok('and stays within reach', Math.hypot(lifted.pos.x - pl.x, lifted.pos.y - pl.y) < 140, Math.hypot(lifted.pos.x - pl.x, lifted.pos.y - pl.y));
  const far = await w2p(X+900, Y-700);                        // cursor far away
  await p.mouse.move(far.x, far.y); await p.waitForTimeout(600);
  const held = (await stats()).filter(o => o.id === lil.id)[0];
  const pl2 = await pos();
  const dFar = Math.hypot(held.pos.x - pl2.x, held.pos.y - pl2.y), dLift = Math.hypot(lifted.pos.x - pl.x, lifted.pos.y - pl.y);
  ok('pointing far away, it stops at arm length', dFar < 140 && dFar > 50, dFar);
  ok('and no further out than before — the cursor picks the direction, not the distance', Math.abs(dFar - dLift) < 8, { far: dFar, lifted: dLift });
  const onMe = await w2p(pl2.x, pl2.y);                       // cursor right on yourself
  await p.mouse.move(onMe.x + 2, onMe.y - 30); await p.waitForTimeout(600);
  const near = (await stats()).filter(o => o.id === lil.id)[0];
  const pl2b = await pos();
  const dNear = Math.hypot(near.pos.x - pl2b.x, near.pos.y - pl2b.y);
  ok('pointing at yourself does not pull it in either', Math.abs(dNear - dLift) < 8, { near: dNear, lifted: dLift });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(700); await p.keyboard.up('KeyD'); await p.waitForTimeout(200);
  const walkedWith = (await stats()).filter(o => o.id === lil.id)[0];
  const pl3 = await pos();
  ok('you can walk while carrying and it comes along', pl3.x > pl2.x + 60 && Math.abs(walkedWith.pos.x - pl3.x) < 160, { player: pl3.x, sponge: walkedWith.pos.x });
  await p.keyboard.up('KeyQ'); await p.waitForTimeout(700);
  const dropped = (await stats()).filter(o => o.id === lil.id)[0];
  ok('let go and it falls', !(await grabbing()) && dropped.pos.y > held.pos.y + 40, { was: held.pos.y, now: dropped.pos.y });

  console.log('');
  console.log('== a heavy sponge is dragged, not carried ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+400, Y+140);
  await lockAll();
  await rect('sponge', 1, X, Y-20, X+90, Y+100);            // a big one
  await play();
  await standAt(X-22, Y+60); await p.waitForTimeout(300);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('grabbed', await grabbing());
  ok('but too heavy to lift', !(await p.evaluate(() => window.__pg.carrying())));
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== anything can be made grabbable ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+400, Y+140);
  await lockAll();
  await rect('wood', 1, X, Y+60, X+40, Y+100);              // a little wooden crate
  const crate = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0];
  await play();
  await standAt(X-22, Y+60); await p.waitForTimeout(300);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('wood is not grabbable by itself', !(await grabbing()));
  await p.keyboard.up('KeyQ');
  // the toggle is set in Build, as it would be from the box, then played
  await p.evaluate(() => window.__pg.setMode('build')); await p.waitForTimeout(300);
  const crate2 = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0];
  await p.evaluate(id => window.__pg.setGrabbable(id, true), crate2.id);
  const sv = await p.evaluate(() => window.__pg.serialize('g'));
  ok('the save remembers it', sv.objects.some(o => o.grab === 1), sv.objects.map(o => o.grab));
  await play();
  await standAt(X-22, Y+60); await p.waitForTimeout(300);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('made grabbable, the crate can be picked up', !!(await p.evaluate(() => window.__pg.carrying())));
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== you cannot ride what you are holding ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+400, Y+140);
  await lockAll();
  await rect('sponge', 1, X, Y+60, X+40, Y+100);
  await play();
  await standAt(X-22, Y+60); await p.waitForTimeout(300);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('holding the little sponge', !!(await p.evaluate(() => window.__pg.carrying())));
  const y0 = (await pos()).y;
  // keep the cursor under your own feet, as a person trying this would, and keep jumping
  let lowest = y0;
  for (let i = 0; i < 12; i++){
    const pp = await pos();
    const under = await w2p(pp.x, pp.y + 70);
    await p.mouse.move(under.x, under.y);
    await p.waitForTimeout(200);
    if (i % 2 === 1) await p.keyboard.press('Space');
    lowest = Math.min(lowest, (await pos()).y);
  }
  await p.waitForTimeout(1300);                               // let the last jump land
  const y1 = (await pos()).y;
  ok('it is still in hand — it just is not something you can stand on', !!(await p.evaluate(() => window.__pg.carrying())));
  ok('and you end up back on the floor, not on it', y1 > y0 - 12, { before: y0, after: y1 });
  ok('never having got more than a jump off the ground', lowest > y0 - 320, { lowest, start: y0 });
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== what you hold goes around you, never through you ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+400, Y+140);
  await lockAll();
  await rect('sponge', 1, X, Y+60, X+40, Y+100);
  await play();
  await standAt(X-22, Y+60); await p.waitForTimeout(300);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('holding the little sponge', !!(await p.evaluate(() => window.__pg.carrying())));
  const c0 = await pos();
  let deepest = 0, wentOver = false;
  const sampleOverlap = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms){
    const d = await p.evaluate(() => window.__pg.holdOverlap()); if (d != null && d > deepest) deepest = d;
    const sp2 = await p.evaluate(() => window.__pg.playerPos()); const ob = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0];
    if (ob && ob.pos.y < sp2.y - 40) wentOver = true;
    await p.waitForTimeout(30); } };
  for (let i = 0; i < 4; i++){                               // sweep the cursor straight across yourself, both ways
    const l = await w2p(c0.x - 150, c0.y - 20), r = await w2p(c0.x + 150, c0.y - 20);
    await p.mouse.move(l.x, l.y); await sampleOverlap(400);
    await p.mouse.move(r.x, r.y); await sampleOverlap(400);
  }
  const c1 = await pos();
  ok('sweeping it from side to side never moves you', Math.abs(c1.x - c0.x) < 4 && Math.abs(c1.y - c0.y) < 4, { from: c0, to: c1 });
  ok('it passes over your head to get to the other side', wentOver);
  ok('and never ends up inside you', deepest < 3, deepest);
  const under = await w2p(c0.x, c0.y + 150); await p.mouse.move(under.x, under.y);
  deepest = 0; await sampleOverlap(700);
  const c2 = await pos();
  ok('pointing under your own feet, it sits beside them rather than inside you', deepest < 3, deepest);
  ok('and still does not move you', Math.abs(c2.x - c0.x) < 4 && Math.abs(c2.y - c0.y) < 4, { from: c0, to: c2 });
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== a swing has a top speed ==');
  await fresh();
  await rect('wood', 1, X-400, Y+300, X+400, Y+340);
  await rect('wood', 1, X, Y-140, X+80, Y-60);
  await lockAll();
  await rect('sponge', 1, X+20, Y+80, X+60, Y+140);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('rope'); });
  await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [X+40, Y-100]);
  await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [X+40, Y+110]);
  await play();
  await p.waitForTimeout(600);
  const sw = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0];
  await p.keyboard.down('KeyQ');
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [sw.pos.x - 34, sw.pos.y - 60]);
  await p.waitForTimeout(500);
  ok('hanging from it', await grabbing());
  let topSpeed = 0, deepestSwing = 0;
  const pump = async (key, ms) => { await p.keyboard.down(key); const t0 = Date.now(); while (Date.now() - t0 < ms){
    const v = await p.evaluate(() => window.__pg.playerVel()); if (v) topSpeed = Math.max(topSpeed, Math.hypot(v.x, v.y));
    const d = await p.evaluate(() => window.__pg.holdOverlap()); if (d != null) deepestSwing = Math.max(deepestSwing, d);
    await p.waitForTimeout(30); } await p.keyboard.up(key); };
  for (let i = 0; i < 4; i++){ await pump('KeyD', 700); await pump('KeyA', 700); }   // pump as hard as you like
  console.log('   top speed', topSpeed.toFixed(1), 'deepest overlap', deepestSwing);
  ok('you do swing', topSpeed > 4, topSpeed);
  ok('but never faster than the cap', topSpeed < 11.5, topSpeed);
  ok('and you do not get pulled into what you hold', deepestSwing < 4, deepestSwing);
  ok('still holding on', await grabbing());
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== a heavy load makes for a poor jump ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+400, Y+140);
  await lockAll();
  await play();
  await standAt(X-100, Y+60); await p.waitForTimeout(400);
  const j0 = (await pos()).y;
  await p.keyboard.press('Space');
  let peak0 = j0;
  for (let i = 0; i < 8; i++){ await p.waitForTimeout(55); peak0 = Math.min(peak0, (await pos()).y); }
  const freeJump = j0 - peak0;
  await p.evaluate(() => window.__pg.setMode('build')); await p.waitForTimeout(250);
  await p.evaluate(() => window.__pg.paused(true));
  await rect('wood', 1, X, Y+20, X+60, Y+100);              // a hefty wooden block, about 2.3 players' worth
  const heavy = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0];
  await p.evaluate(id => window.__pg.setGrabbable(id, true), heavy.id);
  await play();
  await standAt(X-30, Y+60); await p.waitForTimeout(400);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(300);
  ok('the heavy block can be picked up', !!(await p.evaluate(() => window.__pg.carrying())));
  const hi = await w2p(X+70, Y+40); await p.mouse.move(hi.x, hi.y); await p.waitForTimeout(500);   // hold it out to the side, not over your head
  const j1 = (await pos()).y;
  await p.keyboard.press('Space');
  let peak = j1;                                             // a short hop peaks early: sample as it goes
  for (let i = 0; i < 6; i++){ await p.waitForTimeout(55); peak = Math.min(peak, (await pos()).y); }
  const loadedJump = j1 - peak;
  console.log('   jumped', freeJump.toFixed(0) + 'px free,', loadedJump.toFixed(0) + 'px loaded');
  ok('you still get off the ground', loadedJump > 5, loadedJump);
  ok('but nowhere near as high', loadedJump < freeJump * 0.55, { freeJump, loadedJump });
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log((fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join(String.fromCharCode(10)) : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
