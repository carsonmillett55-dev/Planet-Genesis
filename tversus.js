/* Versus: players collide, the camera frames everyone, a launcher's shot
   is a knockout, lives put a player out, the winner is named and the
   round starts over; an adventure's shot only splats.  node tversus.js */
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
  const players = () => p.evaluate(() => window.__pg.players());
  const pvp = () => p.evaluate(() => window.__pg.pvp());
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
  const wset = (k, v) => p.evaluate(([k, v]) => window.__pg.worldSet(k, v), [k, v]);
  const fireAt = (i, x, y) => p.evaluate(([i,x,y]) => window.__pg.fireAt(i, x, y), [i,x,y]);
  const join2 = async () => { await pads([pad(), pad({ press: [9] })]); await p.waitForTimeout(120); await pads([pad(), pad()]); await p.waitForTimeout(150); };

  console.log('== a Versus level with two players ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+1050, Y+140);   // floor (the drag starts and ends on the screen)
  await lockAll();
  await wset('levelType', 'versus'); await wset('knockouts', 2); await wset('lives', 0);
  const gun = await place('gun', X+100, Y+40);
  ok('a launcher in the arena', !!gun);
  await p.evaluate(id => window.__pg.gadgetSet(id, { pgrav: 0 }), gun.id);   // straight shots, so a test can aim
  await play(); await join2();
  let ps = await players();
  ok('two players', ps.length === 2, ps);
  ok('each in their own collision group', (await pvp()).map(q => q.group).join(',') === '-9,-10', await pvp());
  ok('the HUD names both, with their knockouts', JSON.stringify(await p.evaluate(() => window.__pg.playersHud())) === JSON.stringify(['Player 1 · ⚔ 0', 'Player 2 · ⚔ 0']), await p.evaluate(() => window.__pg.playersHud()));

  console.log('== players collide: one stands on the other ==');
  await standAt(X, Y+60); await standAt2(1, X, Y-40); await p.waitForTimeout(700);
  ps = await players();
  ok('player two lands on player one\'s head', ps[1].y < ps[0].y - 40 && ps[1].grounded, ps.map(q => [q.id, Math.round(q.x), Math.round(q.y), q.grounded]));

  console.log('== the camera keeps everyone in view ==');
  await standAt(X+100, Y+60); await standAt2(1, X+150, Y+60); await p.waitForTimeout(500);
  const vNear = await p.evaluate(() => window.__pg.view());
  await standAt2(1, X+1400, Y+60); await p.waitForTimeout(1200);   // past the floor's end: further than a screen at the level's zoom
  const vFar = await p.evaluate(() => window.__pg.view());
  ps = await players();
  ok('apart, the view holds both players', vFar.x < ps[0].x - 40 && vFar.x + vFar.w > ps[1].x + 40, { view: vFar, p1: ps[0].x, p2: ps[1].x });
  ok('zoomed out to do it, and centred between them', vFar.zoom < vNear.zoom - 0.05 && Math.abs(vFar.x + vFar.w/2 - (ps[0].x + ps[1].x)/2) < 60, { near: vNear.zoom, far: vFar.zoom, mid: vFar.x + vFar.w/2, want: (ps[0].x + ps[1].x)/2 });

  console.log('== a launcher\'s shot is a knockout ==');
  await standAt(X-200, Y+60); await standAt2(1, X+200, Y+60); await p.waitForTimeout(300);
  ok('both armed', await p.evaluate(() => window.__pg.armAll()) && (await players()).every(q => q.armed), await players());
  ps = await players();
  await fireAt(0, ps[1].x, ps[1].y);
  let hit = false; for (let i = 0; i < 30 && !hit; i++){ await p.waitForTimeout(50); hit = (await pvp())[1].dead === 1; }
  ok('player one\'s shot knocks player two out', hit, await pvp());
  ok('a knockout for player one', (await pvp())[0].kos === 1 && /knockout for Player 1/.test(await toast()), { pvp: await pvp(), toast: await toast() });
  await p.waitForTimeout(400);
  ps = await players();
  ok('player two is back at the start, not in a bubble', !ps[1].bubble && Math.abs(ps[1].x - (X+200)) > 100, ps[1]);
  ok('the HUD counts it', JSON.stringify(await p.evaluate(() => window.__pg.playersHud())) === JSON.stringify(['Player 1 · ⚔ 1', 'Player 2 · ⚔ 0']), await p.evaluate(() => window.__pg.playersHud()));
  ok('the round is not over yet', !(await p.evaluate(() => window.__pg.run())).over);
  // the second knockout wins
  await standAt(X-200, Y+60); await standAt2(1, X+200, Y+60); await p.waitForTimeout(1000);   // past the respawn grace
  ps = await players();
  await fireAt(0, ps[1].x, ps[1].y);
  hit = false; for (let i = 0; i < 30 && !hit; i++){ await p.waitForTimeout(50); hit = (await pvp())[0].kos === 2; }
  ok('the second knockout', hit, await pvp());
  ok('names the winner, and the round is over', /Player 1 wins/.test(await toast()) && (await p.evaluate(() => window.__pg.run())).over, await toast());
  await p.waitForTimeout(3000);
  ok('a new round begins with the counts back to nought', (await pvp()).every(q => q.kos === 0 && q.dead === 0) && !(await p.evaluate(() => window.__pg.run())).over, await pvp());

  console.log('== with lives, the last one standing wins ==');
  await build();
  await wset('lives', 1); await wset('knockouts', 20);
  await play(); await p.waitForTimeout(200);
  ok('the HUD shows a life each', JSON.stringify(await p.evaluate(() => window.__pg.playersHud())) === JSON.stringify(['Player 1 · ⚔ 0 · ❤ 1', 'Player 2 · ⚔ 0 · ❤ 1']), await p.evaluate(() => window.__pg.playersHud()));
  await standAt(X-200, Y+60); await standAt2(1, X+200, Y+60); await p.waitForTimeout(1000);
  ok('both armed again', await p.evaluate(() => window.__pg.armAll()));
  ps = await players();
  await fireAt(0, ps[1].x, ps[1].y);
  hit = false; for (let i = 0; i < 30 && !hit; i++){ await p.waitForTimeout(50); hit = (await pvp())[1].dead === 1; }
  ok('player two is hit', hit, await pvp());
  ok('and out for the round, in a bubble', (await pvp())[1].out && !!(await players())[1].bubble, { pvp: await pvp(), p2: (await players())[1] });
  ok('player one wins', /Player 1 wins/.test(await toast()), await toast());
  await p.waitForTimeout(3000);
  ps = await players();
  ok('the next round: both back in, side by side at the start', !ps[1].bubble && !(await pvp())[1].out && Math.abs(ps[0].x - ps[1].x) > 30 && Math.abs(ps[0].x - ps[1].x) < 120, ps.map(q => [q.id, Math.round(q.x), Math.round(q.y), !!q.bubble]));

  console.log('== a hazard in Versus: a death for nobody\'s credit ==');
  await build();
  await wset('lives', 0);
  await rect('hazard', 1, X+560, Y+80, X+640, Y+100);
  await lockAll();
  await play(); await p.waitForTimeout(200);
  await standAt(X-200, Y+60); await standAt2(1, X+600, Y+60);
  hit = false; for (let i = 0; i < 30 && !hit; i++){ await p.waitForTimeout(50); hit = (await pvp())[1].dead === 1; }
  ok('the hazard counts as a death', hit, await pvp());
  ok('but a knockout for nobody', (await pvp()).every(q => q.kos === 0), await pvp());
  ps = await players();
  ok('player two respawns, no bubble', !ps[1].bubble, ps[1]);

  console.log('== in an adventure a shot only splats on a friend ==');
  await build();
  await wset('levelType', 'adventure');
  await play(); await p.waitForTimeout(200);
  await standAt(X-200, Y+60); await standAt2(1, X+200, Y+60); await p.waitForTimeout(300);
  ok('armed', await p.evaluate(() => window.__pg.armAll()));
  ps = await players();
  const d0 = (await p.evaluate(() => window.__pg.run())).deaths;
  await fireAt(0, ps[1].x, ps[1].y);
  await p.waitForTimeout(900);
  ok('player two is fine', (await p.evaluate(() => window.__pg.run())).deaths === d0 && !(await players())[1].bubble && Math.abs((await players())[1].x - (X+200)) < 40, { deaths: (await p.evaluate(() => window.__pg.run())).deaths, p2: (await players())[1] });
  ok('the players HUD is for Versus only', (await p.evaluate(() => window.__pg.playersHud())) === null);
  await pads([pad(), null]); await p.evaluate(() => { window.__pgFakePads = null; window.__pgFakePad = undefined; });
  await build();

  console.log('== no page errors ==');
  ok('no errors', errs.length === 0, errs);
  await b.close();
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  process.exit(fail ? 1 : 0);
})();
