/* Local players: a second pad joins as a second character, each drives
   their own, the level sees them all, the camera follows the first and
   one left behind floats back in a bubble.  node tplayers.js */
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
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); window.__pg.setPaintMode('rect'); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const gadgets = () => p.evaluate(() => window.__pg.gadgets());
  const kinds = (k) => gadgets().then(gs => gs.filter(g => g.kind === k));
  const G = async (k, i) => (await kinds(k))[i || 0];
  const players = () => p.evaluate(() => window.__pg.players());
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(true); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const build = async () => { await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(300); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };
  const standAt2 = async (i, x, y) => { await p.evaluate(([i,x,y]) => window.__pg.playerTo2(i,x,y), [i,x,y]); await p.waitForTimeout(350); };
  const place = async (k, x, y) => { await p.evaluate(kk => { window.__pg.setLayer(1); window.__pg.setTool(kk); }, k); await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [x,y]); return kinds(k).then(gs => gs[gs.length - 1]); };
  const pad = (over) => { const bt = []; for (let i = 0; i < 17; i++) bt.push({ pressed: false, value: 0 }); const g = { connected: true, axes: [0, 0, 0, 0], buttons: bt }; if (over){ if (over.axes) g.axes = over.axes; (over.press || []).forEach(i => { bt[i].pressed = true; bt[i].value = 1; }); } return g; };
  const pads = async (list) => { await p.evaluate(l => window.__pg.fakePads(l), list); await p.waitForTimeout(80); };
  const toast = () => p.evaluate(() => document.getElementById('toast').textContent);

  console.log('== one player: the keyboard, and the first pad ==');
  await fresh();
  let ps = await players();
  ok('one player to begin with — the keyboard one, bound', ps.length === 1 && ps[0].slot === 0 && ps[0].keyboard && ps[0].bound, ps);
  await pads([pad()]);
  ps = await players();
  ok('the first pad goes to the first player', ps.length === 1 && ps[0].pad === 0, ps);
  await pads([pad(), pad()]);
  await p.waitForTimeout(200);
  ps = await players();
  ok('a second pad plugged in is nobody yet', ps.length === 1, ps);

  console.log('== a second pad presses Start: player two ==');
  await rect('wood', 1, X-380, Y+100, X+800, Y+140);   // floor (a drag must start on the screen)
  await lockAll();
  await play(); await standAt(X-200, Y+60);
  const p1y0 = (await pos()).y;
  await pads([pad(), pad({ press: [9] })]);
  await p.waitForTimeout(120);
  ps = await players();
  ok('Start on the free pad joins a second player, with that pad', ps.length === 2 && ps[1].pad === 1 && !ps[1].keyboard, ps);
  ok('spawned beside the first (and nudged apart — players collide)', ps.length === 2 && Math.abs(ps[1].x - ps[0].x) < 70 && Math.abs(ps[1].y - ps[0].y) < 80, ps);
  ok('in their own colour', ps.length === 2 && ps[1].color !== ps[0].color, ps);
  ok('and it says so', /Player 2 joined/.test(await toast()));
  ok('the pause menu did not open on that Start', await p.evaluate(() => document.getElementById('pauseOverlay').hidden));
  await pads([pad(), pad()]);
  await p.waitForTimeout(400);
  ps = await players();
  ok('the first player is still the bound one', ps[0].bound && !ps[1].bound, ps);

  console.log('== each pad drives its own character ==');
  const before = await players();
  await pads([pad(), pad({ axes: [1, 0, 0, 0] })]);
  await p.waitForTimeout(500);
  ps = await players();
  ok('the second stick walks the second player right', ps[1].x > before[1].x + 60, { from: before[1].x, to: ps[1].x });
  ok('and not the first', Math.abs(ps[0].x - before[0].x) < 10, { from: before[0].x, to: ps[0].x });
  await pads([pad(), pad()]);
  await p.waitForTimeout(150);
  const b2 = await players();
  await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(400); await p.keyboard.up('ArrowLeft');
  ps = await players();
  ok('the keyboard walks the first player left', ps[0].x < b2[0].x - 50, { from: b2[0].x, to: ps[0].x });
  ok('and not the second', Math.abs(ps[1].x - b2[1].x) < 10, { from: b2[1].x, to: ps[1].x });
  await p.waitForTimeout(300);
  const b3 = await players();
  await pads([pad(), pad({ press: [0] })]);
  let top2 = b3[1].y, top1 = b3[0].y;
  for (let i = 0; i < 14; i++){ await p.waitForTimeout(40); const q = await players(); if (q[1].y < top2) top2 = q[1].y; if (q[0].y < top1) top1 = q[0].y; }
  ok('A on the second pad jumps the second player', top2 < b3[1].y - 25, { from: b3[1].y, top: top2 });
  ok('and not the first', top1 > b3[0].y - 6, { from: b3[0].y, top: top1 });
  await pads([pad(), pad()]);
  await p.waitForTimeout(600);
  ok('both are back on the ground', (await players()).every(q => q.grounded), await players());

  console.log('== the level sees every player ==');
  await build();
  await rect('wood', 1, X+300, Y+40, X+360, Y+100);   // a post far from player one
  await lockAll();
  const post = await p.evaluate(() => { const os = window.__pg.objects(); const o = os[os.length - 1]; return { x: o.body.position.x, y: o.body.position.y }; });
  const sn = await place('sensor', post.x, post.y);
  ok('a sensor on the post', !!sn && sn.obj !== null, sn);
  await play(); await standAt(X-300, Y+60); await standAt2(1, post.x - 80, Y+60);
  await p.waitForTimeout(300);
  ok('the sensor sees the second player, with the first far away', (await G('sensor')).out === 1, await G('sensor'));
  await standAt2(1, X-250, Y+60); await p.waitForTimeout(300);
  ok('and not when neither is near', (await G('sensor')).out === 0);
  await build();

  console.log('== the camera follows the first; one left behind comes back in a bubble ==');
  await play(); await standAt(X+400, Y+60); await standAt2(1, X+450, Y+60); await p.waitForTimeout(200);
  let v = await p.evaluate(() => window.__pg.view());
  let q = await players();
  ok('the camera is on the first player', Math.abs(v.x + v.w/2 - q[0].x) < 40, { cam: v.x + v.w/2, p1: q[0].x });
  await p.evaluate(([i,x,y]) => window.__pg.playerTo2(i,x,y), [1, X+400 + 1500, Y+60]);   // off the right of the screen
  let seen = null; for (let i = 0; i < 30 && !seen; i++){ await p.waitForTimeout(60); const qq = (await players())[1]; if (qq.bubble) seen = qq.bubble; }
  ok('off the screen for a moment, the second player is in a bubble', !!seen, await players());
  ok('the bubble is kept on the screen', seen && seen.x < v.x + v.w && seen.x > v.x, { bubble: seen, view: v });
  await p.waitForTimeout(2500);
  q = await players();
  ok('it floats to the first player and pops', !q[1].bubble && Math.abs(q[1].x - q[0].x) < 60 && q[1].y < q[0].y + 60, q);
  ok('the first player never moved', Math.abs(q[0].x - (X+400)) < 30, q[0]);

  console.log('== dying is a bubble too, for the second player ==');
  await build();
  await rect('hazard', 1, X+560, Y+80, X+640, Y+100);   // a zap patch on the floor
  await lockAll();
  await play(); await standAt(X+400, Y+60); await standAt2(1, X+450, Y+60); await p.waitForTimeout(600);
  const run0 = await p.evaluate(() => window.__pg.run());
  await pads([pad(), pad({ axes: [1, 0, 0, 0] })]);   // player two walks onto it
  let bubbled = false; for (let i = 0; i < 40 && !bubbled; i++){ await p.waitForTimeout(100); bubbled = !!(await players())[1].bubble; }
  ok('the second player touches the hazard and is bubbled, not sent to the checkpoint', bubbled, await players());
  await pads([pad(), pad()]);
  ok('it counted as a death', (await p.evaluate(() => window.__pg.run())).deaths === run0.deaths + 1, await p.evaluate(() => window.__pg.run()));
  q = await players();
  ok('the first player carried on where they were', Math.abs(q[0].x - (X+400)) < 30, q[0]);
  await p.waitForTimeout(2500);
  q = await players();
  ok('and the second is back beside them', !q[1].bubble && Math.abs(q[1].x - q[0].x) < 70, q);
  // the first player dying goes to the checkpoint as ever
  await standAt(X+580, Y+60); await p.waitForTimeout(400);
  q = await players();
  ok('the first player on the hazard respawns at the start', !q[0].bubble && Math.abs(q[0].x - (X+400)) > 100, q[0]);

  console.log('== back to Build, everyone together; a pad gone, its player leaves ==');
  await standAt2(1, X+700, Y+60);
  await build();
  q = await players();
  ok('leaving Play gathers the second player beside the first', q.length === 2 && Math.abs(q[1].x - q[0].x) < 20, q);
  await pads([pad(), null]);
  await p.waitForTimeout(1500);
  ok('a pad gone for a moment keeps its player', (await players()).length === 2);
  await pads([pad(), pad()]);
  await p.waitForTimeout(200);
  q = await players();
  ok('back within a few seconds, they take it up again', q.length === 2 && q[1].pad === 1, q);
  await pads([pad(), null]);
  await p.waitForTimeout(4600);
  ok('gone for good, the player leaves', (await players()).length === 1, await players());
  await pads([pad()]);
  await p.evaluate(() => { window.__pgFakePads = null; window.__pgFakePad = undefined; });
  await p.waitForTimeout(150);
  ok('and the first player is as they were', (await players()).length === 1 && (await players())[0].bound);

  console.log('== a second player on the keyboard: U joins, I J K L walk ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+800, Y+140);
  await lockAll();
  await play(); await standAt(X+200, Y+60);
  await p.keyboard.press('KeyU'); await p.waitForTimeout(150);
  ps = await players();
  ok('U in Play joins a second player on the keyboard', ps.length === 2 && ps[1].keyboard2 && ps[1].pad === null, ps);
  ok('and says which keys', /I J K L/.test(await toast()), await toast());
  await p.waitForTimeout(400);
  const kb0 = await players();
  await p.keyboard.down('KeyL'); await p.waitForTimeout(400); await p.keyboard.up('KeyL');
  ps = await players();
  ok('L walks player two right', ps[1].x > kb0[1].x + 50, { from: kb0[1].x, to: ps[1].x });
  ok('and not player one', Math.abs(ps[0].x - kb0[0].x) < 10, { from: kb0[0].x, to: ps[0].x });
  await p.waitForTimeout(200);
  const kb1 = await players();
  await p.keyboard.press('KeyU');
  let ktop = kb1[1].y; for (let i = 0; i < 14; i++){ await p.waitForTimeout(40); const q2 = await players(); if (q2[1].y < ktop) ktop = q2[1].y; }
  ok('U jumps player two', ktop < kb1[1].y - 25, { from: kb1[1].y, top: ktop });
  await p.waitForTimeout(600);
  const kb2 = await players();
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(300); await p.keyboard.up('ArrowRight');
  ps = await players();
  ok('the arrows still walk player one only', ps[0].x > kb2[0].x + 40 && Math.abs(ps[1].x - kb2[1].x) < 10, { p1: [kb2[0].x, ps[0].x], p2: [kb2[1].x, ps[1].x] });
  await p.waitForTimeout(300);
  ok('the pad loop leaves the keyboard player be', (await players()).length === 2);
  await p.evaluate(() => window.__pg.removePlayer(1));
  ok('leaving', (await players()).length === 1);
  await build();

  console.log('== no page errors ==');
  ok('no errors', errs.length === 0, errs);
  await b.close();
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  process.exit(fail ? 1 : 0);
})();
