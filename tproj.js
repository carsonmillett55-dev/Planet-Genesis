/* Projectiles: the launcher powerup (bullets, a drawn projectile, a saved
   object, a ray), the projectile sensor, projectiles that hurt creatures,
   and an emitter firing bullets.  node tproj.js */
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
  await p.evaluate(() => { localStorage.removeItem('pg_my_skins'); window.__pg.freezeCam(); window.__pg.setStick(false); window.__pg.setPaintMode('rect'); });
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
  const kind = (k) => gadgets().then(gs => gs.filter(g => g.kind === k)[0]);
  const kinds = (k) => gadgets().then(gs => gs.filter(g => g.kind === k));
  const idOf = async (k, i) => (await kinds(k))[i || 0].id;
  const stats = () => p.evaluate(() => window.__pg.stats());
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
  const place = async (k, x, y) => { await p.evaluate(kk => { window.__pg.setLayer(1); window.__pg.setTool(kk); }, k); await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [x,y]); return kinds(k).then(gs => gs[gs.length - 1]); };
  const st = (cmd, a, b2) => p.evaluate(([c, x, y]) => window.__pg.studio(c, x, y), [cmd, a, b2]);
  const stroke = async (x0, y0, x1, y1) => { const r = await st('canvasRect'); await p.mouse.move(r.x + r.w * x0, r.y + r.h * y0); await p.mouse.down(); await p.mouse.move(r.x + r.w * x1, r.y + r.h * y1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(60); };

  console.log('== the launcher: touch it and you are armed; a click fires a bullet toward the cursor ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);            // floor
  await rect('wood', 1, X+300, Y-100, X+340, Y+100);            // a wall to shoot at
  await lockAll();
  const gun = await place('gun', X-100, Y+40);                  // floating in the air, no host
  ok('the Launcher tool puts a powerup down, on nothing', !!gun && gun.obj === null && gun.mode === 'bullet', gun && { obj: gun.obj, mode: gun.mode });
  const ps = await place('projsensor', X+320, Y);               // on the wall
  ok('and a Projectile sensor sits on the wall', !!ps && ps.obj !== null);
  await play();
  ok('not armed to start with', (await p.evaluate(() => window.__pg.gun())) === null);
  await standAt(X-100, Y+60); await p.waitForTimeout(300);
  const armed = await p.evaluate(() => window.__pg.gun());
  ok('walking into the launcher arms you with bullets, no end of them', !!armed && armed.mode === 'bullet' && armed.ammo === 0, armed);
  await p.evaluate(([x,y]) => window.__pg.fire(x,y), [X+320, Y-60]);   // aimed a little up: the bullet drops as it flies
  await p.waitForTimeout(80);
  let pj = await p.evaluate(() => window.__pg.projectiles());
  ok('a shot puts a bullet in the air, flying toward the wall', pj.length === 1 && pj[0].vel.x > 3, pj);
  let sensed = false;
  for (let i = 0; i < 12; i++){ await p.waitForTimeout(50); if ((await kind('projsensor')).out === 1) sensed = true; }
  ok('it hits the wall and the projectile sensor there goes on', sensed, await kind('projsensor'));
  ok('and having hit, the bullet is gone', (await p.evaluate(() => window.__pg.projectiles())).length === 0);
  await build();

  console.log('');
  console.log('== shots that run out; a ray; a saved object as ammo ==');
  await p.evaluate(id => window.__pg.gadgetSet(id, { ammo: 2 }), await idOf('gun'));
  await play();
  await standAt(X-100, Y+60); await p.waitForTimeout(300);
  ok('two shots to start', (await p.evaluate(() => window.__pg.gun())).left === 2);
  await p.evaluate(([x,y]) => window.__pg.fire(x,y), [X+320, Y-60]); await p.waitForTimeout(50);
  await p.evaluate(([x,y]) => window.__pg.fire(x,y), [X+320, Y-60]); await p.waitForTimeout(50);
  const left = await p.evaluate(([x,y]) => window.__pg.fire(x,y), [X+320, Y-60]);
  ok('after two, none left and the third does nothing', left === 0 && (await p.evaluate(() => window.__pg.projectiles())).length <= 2, left);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { ammo: 0, mode: 'ray' }), await idOf('gun'));
  await play();
  await standAt(X-100, Y+60); await p.waitForTimeout(300);
  await p.evaluate(([x,y]) => window.__pg.fire(x,y), [X+320, Y+50]); await p.waitForTimeout(60);
  ok('a ray: no bullet in the air, and the sensor on the wall goes on at once', (await p.evaluate(() => window.__pg.projectiles())).length === 0 && (await kind('projsensor')).out === 1, await kind('projsensor'));
  await build();
  await rect('sponge', 1, X-300, Y+40, X-240, Y+100);
  await p.evaluate(() => { const o = window.__pg.objects().slice(-1)[0]; window.__pg.select(o); window.__pg.saveSelectedAs('Ball'); window.__pg.deselect(); });
  await p.evaluate(() => { const o = window.__pg.objects().slice(-1)[0]; window.__pg.select(o); window.__pg.anchor(); window.__pg.deselect(); });
  const sv = await p.evaluate(() => window.__pg.savedObjects());
  await p.evaluate(([id, sid]) => window.__pg.emitterUse(id, sid), [await idOf('gun'), sv[0].id]);   // the same capture an emitter uses
  await p.evaluate(id => window.__pg.gadgetSet(id, { mode: 'object' }), await idOf('gun'));
  const nBefore = (await stats()).length;
  await play();
  await standAt(X-100, Y+60); await p.waitForTimeout(300);
  await p.evaluate(([x,y]) => window.__pg.fire(x,y), [X+320, Y+50]); await p.waitForTimeout(100);
  ok('a saved object as ammo: a copy of it flies out', (await p.evaluate(() => window.__pg.emitted())).length === 1 && (await stats()).length === nBefore + 1);
  await build();
  ok('and it is gone from the level again in Build', (await stats()).length === nBefore);

  console.log('');
  console.log('== a drawn projectile: look, hitbox, how it flies; it hurts a creature; an emitter fires bullets ==');
  ok('Draw a new projectile opens the studio', await p.evaluate(() => window.__pg.projDraft()));
  await p.waitForTimeout(200);
  ok('starting on its size, with how it flies', (await st('where')).state === 'size');
  await st('size', 40, 20);
  const nx = await p.evaluate(() => Array.from(document.querySelectorAll('#ceLeft button')).map(b => b.textContent).find(t => /^Next:/.test(t)));
  await st('click', nx); await st('setColor', '#B3261E'); await stroke(0.1, 0.5, 0.9, 0.5);
  await st('go', 'hitbox', 0); await stroke(0.1, 0.5, 0.9, 0.5);
  await st('close'); await p.waitForTimeout(200);
  await p.evaluate(() => { document.getElementById('nameInput').value = 'Dart'; document.getElementById('nameOk').click(); }); await p.waitForTimeout(200);
  const mine = await p.evaluate(() => window.__pg.myProjectiles());
  ok('named, it is in My Projectiles', mine.length === 1 && mine[0].name === 'Dart', mine);
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  await place('gun', X-100, Y+40);
  await p.evaluate(([id, e]) => window.__pg.gunUseProjectile(id, e), [await idOf('gun'), mine[0].id]);
  // a creature to shoot
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('creature'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+250, Y+40]); await p.waitForTimeout(200);
  await st('go', 'idle', 0); await st('setColor', '#5F9E5A'); await stroke(0.2, 0.2, 0.8, 0.8);
  await st('go', 'hitbox', 0); await stroke(0.2, 0.2, 0.8, 0.8);
  await st('close'); await p.waitForTimeout(200);
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 0, range: 10 }), await idOf('creature'));   // it stays put
  await play();
  await standAt(X-100, Y+60); await p.waitForTimeout(300);
  ok('armed with the Dart', (await p.evaluate(() => window.__pg.gun())).name === 'Dart');
  await p.evaluate(([x,y]) => window.__pg.fire(x,y), [X+250, Y-30]);   // aimed up: a dart drops about 90px over that flight
  await p.waitForTimeout(700);
  ok('a dart hits the creature and it dies', (await kinds('creature')).length === 0 || (await kind('creature')).dying === true, (await kind('creature')));
  await build();
  // an emitter that fires bullets
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await rect('wood', 1, X+300, Y-100, X+340, Y+100);
  await lockAll();
  await rect('metal', 1, X-120, Y+40, X-80, Y+100);            // a pedestal for the emitter
  await lockAll();
  await place('objemitter', X-100, Y+44);
  await place('projsensor', X+320, Y);
  await p.evaluate(id => window.__pg.emitterUseProjectile(id, 'bullet'), await idOf('objemitter'));
  await p.evaluate(id => window.__pg.gadgetSet(id, { freq: 0.3, angle: 60, speed: 800 }), await idOf('objemitter'));   // up and to the right, at the wall
  await play();
  let hit = false;
  for (let i = 0; i < 20; i++){ await p.waitForTimeout(60); if ((await kind('projsensor')).out === 1) hit = true; }
  ok('an emitter firing bullets sideways hits the wall: the sensor there goes on', hit);
  await build();

  console.log('');
  console.log('== the save tabs: a creature saved whole, placed ready-made ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('creature'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X, Y+40]); await p.waitForTimeout(200);
  await st('go', 'idle', 0); await st('setColor', '#C89BD9'); await stroke(0.2, 0.3, 0.8, 0.7);
  await st('go', 'hitbox', 0); await stroke(0.5, 0.25, 0.5, 0.75);
  await st('go', 'weakD', 0); await stroke(0.5, 0.25, 0.5, 0.3);
  await st('close'); await p.waitForTimeout(200);
  ok('a creature can be saved whole from the studio', await p.evaluate(id => window.__pg.saveThing(id, 'Blob'), await idOf('creature')));
  const saved = await p.evaluate(() => window.__pg.mySaved('creature'));
  ok('My Creatures lists it, with its hitbox and weak spot', saved.length === 1 && saved[0].name === 'Blob' && saved[0].hasHit && saved[0].hasWeak, saved);
  const menuPages = await p.evaluate(() => { window.__pg.menu('build'); return Array.from(document.querySelectorAll('#pmPages button')).map(b => b.textContent.trim()); });
  ok('the Build section has the save tabs', ['My Objects','My Creatures','My Projectiles','My Particles'].every(t => menuPages.includes(t)), menuPages);
  await p.evaluate(() => window.__pg.menu(null));
  ok('Place puts it in hand', await p.evaluate(id => window.__pg.placeSaved('creature', id), saved[0].id));
  const nCr = (await kinds('creature')).length;
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+250, Y+40]); await p.waitForTimeout(300);
  const placed = (await kinds('creature')).slice(-1)[0];
  ok('a click places it ready-made: no studio, hitbox and weak spot on', (await kinds('creature')).length === nCr + 1 && (await p.evaluate(() => document.getElementById('charEditorOverlay').hidden)) && placed.hitStrokes === 1 && placed.weakArea > 20 && placed.hasSkin && placed.ghost === false, placed && { hit: placed.hitStrokes, weak: placed.weakArea, ghost: placed.ghost });

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
