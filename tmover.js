/* The Mover: an object travels along a line, once or bouncing, at a speed,
   wired or not; the player rides it; the line is set by a second click and
   a knob.  node tmover.js */
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
  const view0 = await p.evaluate(() => window.__pg.view());
  const camHome = () => p.evaluate(v => window.__pg.zoomTo(v.zoom, v.x + v.w/2, v.y + v.h/2), view0);
  const w2p = (x,y) => p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [x,y]);
  async function rect(mat, layer, x0, y0, x1, y1){
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    for (const q of [a, c]) if (q.x < 2 || q.y < 2 || q.x > 1278 || q.y > 758) throw new Error('paint point off the screen: ' + JSON.stringify(q));
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const stats = () => p.evaluate(() => window.__pg.stats());
  const movers = () => p.evaluate(() => window.__pg.gadgets()).then(gs => gs.filter(g => g.kind === 'mover'));
  const theMover = () => movers().then(ms => ms[0]);
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(false); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const build = async () => { await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(300); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };
  const platform = () => stats().then(st => st.filter(o => o.pieces.some(pc => pc.indexOf('metal') === 0))[0]);   // the metal plank

  console.log('');
  console.log('== placing: click the object, then click where it goes ==');
  await fresh();
  await rect('wood', 1, X-380, Y+200, X+400, Y+240);        // floor
  await rect('metal', 1, X, Y+60, X+120, Y+100);            // a plank: the platform
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('mover'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+60, Y+80]);
  ok('the first click puts a mover on the plank and waits for the second', (await movers()).length === 1 && (await p.evaluate(() => window.__pg.moverDraft())) !== null);
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+260, Y+80]);   // 200 to the right
  const m0 = await theMover();
  ok('the second click sets the travel', (await p.evaluate(() => window.__pg.moverDraft())) === null && m0.line && Math.abs(m0.line.dx - 200) < 1 && Math.abs(m0.line.dy) < 1, m0.line);
  ok('it starts at a walking pace, travelling once', m0.speed === 120 && m0.bounce === false, m0);
  // Esc cancels a half-made one
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+30, Y+80]);
  ok('a second mover waits for its click', (await movers()).length === 2);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok('and Escape takes it away again', (await movers()).length === 1 && (await p.evaluate(() => window.__pg.moverDraft())) === null);

  // choosing where it goes is a mode of its own: any tool takes the click, and the box can start it
  await p.evaluate(() => window.__pg.setTool('mover'));
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+30, Y+80]);
  ok('a fresh mover waits for its click', (await movers()).length === 2 && (await p.evaluate(() => window.__pg.moverDraft())) !== null);
  await p.evaluate(() => window.__pg.setTool('move'));   // the tool changed under it — the old bug
  const sp2 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+30, Y-120]);
  await p.mouse.click(sp2.x, sp2.y); await p.waitForTimeout(150);
  const m2 = (await movers())[1];
  ok('a click with Select in hand still sets where it goes', (await p.evaluate(() => window.__pg.moverDraft())) === null && m2.line && Math.abs(m2.line.dy + 200) < 2 && Math.abs(m2.line.dx) < 2, m2.line);
  ok('the box can start the choosing again', await p.evaluate(id => window.__pg.moverChoose(id), m2.id) && (await p.evaluate(() => window.__pg.moverDraft())) === m2.id);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok('Esc then keeps the mover and its run', (await movers()).length === 2 && (await p.evaluate(() => window.__pg.moverDraft())) === null && Math.abs((await movers())[1].line.dy + 200) < 2);
  await p.evaluate(id => window.__pg.moverChoose(id), m2.id);
  const sp3 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+330, Y+80]);
  await p.mouse.click(sp3.x, sp3.y); await p.waitForTimeout(150);
  ok('and a click sets a new run', Math.abs((await movers())[1].line.dx - 300) < 2 && Math.abs((await movers())[1].line.dy) < 2, (await movers())[1].line);
  await p.evaluate(id => window.__pg.removeGadget(id), m2.id); await p.waitForTimeout(100);
  ok('(the second mover is taken away again for the rest)', (await movers()).length === 1);

  console.log('');
  console.log('== travelling once, and stopping ==');
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 200 }), m0.id);   // 200px in a second
  const pl0 = await platform();
  await play();                                              // (this itself waits 400ms)
  await p.waitForTimeout(200);
  const plMid = await platform();
  ok('when the level starts it sets off along its line', plMid.pos.x > pl0.pos.x + 60 && plMid.pos.x < pl0.pos.x + 190, { from: pl0.pos.x, now: plMid.pos.x });
  await p.waitForTimeout(900);
  const plEnd = await platform();
  ok('and stops at the end', Math.abs(plEnd.pos.x - (pl0.pos.x + 200)) < 3 && Math.abs(plEnd.pos.y - pl0.pos.y) < 3, { end: plEnd.pos, wanted: [pl0.pos.x + 200, pl0.pos.y] });
  await p.waitForTimeout(500);
  const plStay = await platform();
  ok('and stays there', Math.abs(plStay.pos.x - plEnd.pos.x) < 1, { was: plEnd.pos.x, now: plStay.pos.x });
  await build();
  const plBack = await platform();
  ok('back in Build it is where it was built', Math.abs(plBack.pos.x - pl0.pos.x) < 1, { built: pl0.pos.x, now: plBack.pos.x });

  console.log('');
  console.log('== bouncing back and forth ==');
  await p.evaluate(id => window.__pg.gadgetSet(id, { bounce: true, speed: 400 }), (await theMover()).id);
  await play();
  const xs = []; for (let i = 0; i < 12; i++){ xs.push((await platform()).pos.x); await p.waitForTimeout(150); }
  const maxX = Math.max(...xs), minX = Math.min(...xs);
  console.log('   x over time:', xs.map(x => Math.round(x - pl0.pos.x)).join(' '));
  ok('it goes out to the end', maxX > pl0.pos.x + 150, { maxX, start: pl0.pos.x });
  ok('and comes back', xs.slice(4).some((x, i) => i > 0 && x < xs.slice(4)[i-1] - 20), xs);
  ok('never past either end', minX > pl0.pos.x - 3 && maxX < pl0.pos.x + 203, { minX, maxX });
  await build();

  console.log('');
  console.log('== the player rides it ==');
  await p.evaluate(id => window.__pg.gadgetSet(id, { bounce: false, speed: 150 }), (await theMover()).id);
  await play();
  const plNow = await platform();
  await standAt(plNow.pos.x, plNow.pos.y - 50);            // dropped onto the plank as it travels
  const dropX = (await pos()).x;
  await p.waitForTimeout(600);
  const rideP = await pos(), ridePl = await platform();
  console.log('   player x', Math.round(rideP.x), ' plank x', Math.round(ridePl.pos.x));
  ok('standing on the moving plank carries you along', rideP.x > dropX + 40 && Math.abs(rideP.x - ridePl.pos.x) < 70, { player: rideP.x, plank: ridePl.pos.x, dropped: dropX });
  ok('and you are still on top of it', rideP.y < ridePl.pos.y - 20, { player: rideP.y, plank: ridePl.pos.y });
  await build();

  console.log('');
  console.log('== an unlocked plank is driven all the same, and a wall does not stop it ==');
  await fresh();
  await rect('wood', 1, X-380, Y+200, X+400, Y+240);
  await lockAll();
  await rect('metal', 1, X, Y+60, X+120, Y+100);            // loose: it would fall
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('mover'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+60, Y+80]);
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+60, Y-120]);   // straight up 200
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 400 }), (await theMover()).id);
  const lp0 = await platform();
  await play(); await p.waitForTimeout(900);
  const lp1 = await platform();
  ok('a loose plank does not fall: the mover holds it and lifts it 200px', Math.abs(lp1.pos.y - (lp0.pos.y - 200)) < 3 && Math.abs(lp1.pos.x - lp0.pos.x) < 3, { from: lp0.pos, to: lp1.pos });
  await build();

  console.log('');
  console.log('== wired to a lever, it moves only while the signal is on ==');
  await fresh();
  await rect('wood', 1, X-380, Y+200, X+400, Y+240);
  await rect('metal', 1, X, Y+60, X+120, Y+100);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('mover'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+60, Y+80]);
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+260, Y+80]);
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 400 }), (await theMover()).id);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('lever'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-200, Y+200]);
  const lv = (await p.evaluate(() => window.__pg.gadgets())).filter(g => g.kind === 'lever')[0];
  ok('a lever can be wired to a mover', await p.evaluate(([a,b]) => window.__pg.wire(a,b), [lv.id, (await theMover()).id]));
  const wp0 = await platform();
  await play(); await p.waitForTimeout(600);
  const wp1 = await platform();
  ok('lever off: it stays put', Math.abs(wp1.pos.x - wp0.pos.x) < 2, { from: wp0.pos.x, now: wp1.pos.x });
  await build();
  const lv2 = (await p.evaluate(() => window.__pg.gadgets())).filter(g => g.kind === 'lever')[0];
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), lv2.id);
  await play(); await p.waitForTimeout(900);
  const wp2 = await platform();
  ok('lever on: it travels', Math.abs(wp2.pos.x - (wp0.pos.x + 200)) < 3, { from: wp0.pos.x, now: wp2.pos.x });
  await build();

  console.log('');
  console.log('== the knob, the save, and a resize ==');
  await fresh();
  await rect('wood', 1, X-380, Y+200, X+400, Y+240);
  await rect('metal', 1, X, Y+60, X+120, Y+100);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('mover'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+60, Y+80]);
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+260, Y+80]);
  const km = await theMover();
  await p.evaluate(id => window.__pg.selectGadget(id), km.id); await p.evaluate(() => window.__pg.setTool('move'));
  await p.waitForTimeout(100);
  const kA = await w2p(X+260, Y+80), kB = await w2p(X+260, Y-40);
  await p.mouse.move(kA.x, kA.y); await p.mouse.down(); await p.mouse.move(kB.x, kB.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
  const km2 = await theMover();
  ok('dragging the knob moves the end of the travel', Math.abs(km2.line.dx - 200) < 3 && Math.abs(km2.line.dy - (-120)) < 3, km2.line);
  await p.evaluate(id => window.__pg.gadgetSet(id, { bounce: true, speed: 333 }), km2.id);
  const sv = await p.evaluate(() => window.__pg.serialize('mover'));
  const gs = sv.gadgets.filter(g => g.kind === 'mover')[0];
  ok('the save carries the line, the bounce and the speed', gs && Math.abs(gs.line.dx - 200) < 3 && Math.abs(gs.line.dy + 120) < 3 && gs.bounce === true && gs.speed === 333, gs);
  await p.evaluate(sv => window.__pg.load(sv), sv); await p.waitForTimeout(300);
  const km3 = await theMover();
  ok('and a load brings it back', km3 && Math.abs(km3.line.dx - 200) < 3 && Math.abs(km3.line.dy + 120) < 3 && km3.bounce === true && km3.speed === 333, km3);
  await p.evaluate(() => window.__pg.undo()); await p.waitForTimeout(200);
  ok('undo takes the knob drag back', Math.abs((await theMover()).line.dy) < 3, (await theMover()).line);

  console.log('');
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
