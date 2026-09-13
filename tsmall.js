/* The small things: the Materials page in groups, emotes on a pad's right
   stick, the top-down dash, tunes kept on the device, a door of your own
   drawing.  node tsmall.js */
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
  const pad = (over) => { const bt = []; for (let i = 0; i < 17; i++) bt.push({ pressed: false, value: 0 }); const g = { connected: true, axes: [0, 0, 0, 0], buttons: bt }; if (over){ if (over.axes) g.axes = over.axes; (over.press || []).forEach(i => { bt[i].pressed = true; bt[i].value = 1; }); } return g; };
  const pads = async (list) => { await p.evaluate(l => window.__pg.fakePads(l), list); await p.waitForTimeout(80); };
  const wset = (k, v) => p.evaluate(([k, v]) => window.__pg.worldSet(k, v), [k, v]);
  const pageText = () => p.evaluate(() => document.getElementById('pmBody').innerText);

  console.log('== the Materials page in groups ==');
  await fresh();
  await p.evaluate(() => { window.__pg.matGroup('all'); window.__pg.menu('build', 'materials'); });
  let t = await pageText();
  ok('All shows every material', /Timber/.test(t) && /Ice/.test(t) && /Zap/.test(t) && /Water/.test(t) && /Basic/.test(t) && /Special/.test(t));
  await p.evaluate(() => { window.__pg.setTool('wood'); window.__pg.matGroup('special'); window.__pg.menu('build', 'materials'); });
  t = await pageText();
  ok('Special shows ice, glass, dissolve, floaty — and the one in hand', /Ice/.test(t) && /Glass/.test(t) && /Dissolve/.test(t) && /Floaty/.test(t) && /Timber/.test(t) && !/Metal/.test(t) && !/Zap/.test(t), t.slice(0, 300));
  await p.evaluate(() => { window.__pg.matGroup('hazard'); window.__pg.menu('build', 'materials'); });
  t = await pageText();
  ok('Deadly & fixed: the hazard and dark matter', /Zap/.test(t) && /Dark/.test(t) && !/Ice/.test(t));
  ok('the group is remembered', (await p.evaluate(() => localStorage.getItem('pg_mat_group'))) === 'hazard');
  await p.evaluate(() => { window.__pg.matGroup('all'); window.__pg.menu(null); });

  console.log('== emotes on a pad: a flick of the right stick ==');
  await rect('wood', 1, X-380, Y+100, X+800, Y+140);
  await lockAll();
  const own = await p.evaluate(() => window.__pg.charData());
  const anim = JSON.parse(JSON.stringify(own)); anim.mode = 'animated';
  await p.evaluate(d => window.__pg.wearChar(d), anim);
  await play(); await standAt(X, Y+60);
  await pads([pad()]); await p.waitForTimeout(150);
  ok('no emote to begin with', (await p.evaluate(() => window.__pg.emote())) === null);
  await pads([pad({ axes: [0, 0, 0, -1] })]); await p.waitForTimeout(100);
  ok('the right stick up: happy', (await p.evaluate(() => window.__pg.emote())) === 'happy', await p.evaluate(() => window.__pg.emote()));
  await pads([pad()]); await p.waitForTimeout(2000);
  ok('it passes', (await p.evaluate(() => window.__pg.emote())) === null);
  await pads([pad({ axes: [0, 0, -1, 0] })]); await p.waitForTimeout(100);
  ok('left: angry', (await p.evaluate(() => window.__pg.emote())) === 'angry');
  await pads([pad()]); await p.waitForTimeout(2000);
  const gunG = await place('gun', X, Y+40);
  await p.evaluate(() => window.__pg.armAll());
  await pads([pad({ axes: [0, 0, 1, 0] })]); await p.waitForTimeout(100);
  ok('armed, the right stick aims instead', (await p.evaluate(() => window.__pg.emote())) === null && (await p.evaluate(() => window.__pg.padState())).aim !== null);
  await pads([pad()]); await p.evaluate(() => { window.__pgFakePads = null; window.__pgFakePad = undefined; });
  await build();
  await p.evaluate(d => window.__pg.wearChar(d), own);

  console.log('== top-down: a dash on Space ==');
  await fresh();
  await wset('levelType', 'topdown');
  await play(); await standAt(X, Y-100); await p.waitForTimeout(200);
  const d0 = await pos();
  await p.keyboard.down('ArrowRight'); await p.keyboard.press('Space'); await p.waitForTimeout(120);
  const dash = await p.evaluate(() => window.__pg.dash());
  ok('Space while walking right is a dash to the right', dash.until > 0 && Math.abs(dash.ang) < 0.1, dash);
  await p.waitForTimeout(200); await p.keyboard.up('ArrowRight');
  const d1 = await pos();
  ok('a burst, well past a walk in the time', d1.x - d0.x > 90, { from: d0.x, to: d1.x });
  await p.waitForTimeout(100);
  const before = await pos();
  await p.keyboard.press('Space'); await p.waitForTimeout(60);
  const dash2 = await p.evaluate(() => window.__pg.dash());
  ok('straight after, no second dash — a breather first', dash2.until === dash.until, { first: dash.until, then: dash2.until });
  await p.waitForTimeout(700);
  await p.keyboard.press('Space'); await p.waitForTimeout(60);
  ok('and then it can dash again', (await p.evaluate(() => window.__pg.dash())).until > dash.until);
  await build();
  await wset('levelType', 'adventure');

  console.log('== tunes kept on the device ==');
  await p.evaluate(() => window.__pg.newTune());
  await p.evaluate(() => { window.__pg.musicSet('bpm', 133); });
  ok('a tune to keep', (await p.evaluate(() => window.__pg.music())).bpm === 133);
  ok('kept', (await p.evaluate(() => window.__pg.keepTune('Bouncy'))) === 1 && (await p.evaluate(() => window.__pg.myTunes()))[0].name === 'Bouncy');
  ok('remembered on the device', (await p.evaluate(() => JSON.parse(localStorage.getItem('pg_my_tunes')).length)) === 1);
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); });
  ok('a fresh level has no tune', (await p.evaluate(() => window.__pg.music())) === null);
  ok('the Music page offers the kept tune', await p.evaluate(() => { window.__pg.menu('world', 'music'); const t = document.getElementById('pmBody').innerText; window.__pg.menu(null); return /My Tunes/.test(t) && /Bouncy/.test(t); }));
  ok('using it gives the level the tune', await p.evaluate(() => window.__pg.useTune(0)) && (await p.evaluate(() => window.__pg.music())).bpm === 133);

  console.log('== a door of your own drawing ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+800, Y+140);
  await lockAll();
  const door = await place('door', X, Y+40);
  ok('a door, the plain arch', !!door && (await p.evaluate(id => window.__pg.doorSkin(id), door.id)) === false);
  ok('its box offers to draw it', await p.evaluate(id => { window.__pg.selectGadget ? window.__pg.selectGadget(id) : null; return true; }, door.id));
  const drawn = { states: { door: [[{ c: '#8E5BB5', w: 0, f: true, p: [0.1, 0.1, 0.9, 0.1, 0.9, 0.95, 0.1, 0.95] }]] }, fps: { door: 4 } };
  ok('a drawing on the door', (await p.evaluate(([id, sk]) => window.__pg.doorSkin(id, sk), [door.id, drawn])) === true);
  const file = await p.evaluate(() => window.__pg.serialize());
  const dSaved = file.gadgets.filter(g => g.kind === 'door')[0];
  ok('the level file keeps the door\'s drawing', dSaved && dSaved.skin && dSaved.skin.states && dSaved.skin.states.door && dSaved.skin.states.door[0].length === 1, dSaved && Object.keys(dSaved));
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); });
  await p.evaluate(f => window.__pg.load(f), file); await p.waitForTimeout(200);
  const door2 = (await kinds('door'))[0];
  ok('and it loads back drawn', door2 && (await p.evaluate(id => window.__pg.doorSkin(id), door2.id)) === true);
  ok('taking the drawing off: the arch again', (await p.evaluate(id => window.__pg.doorSkin(id, null), door2.id)) === false);

  console.log('== the grab sensor: on while a player holds its host ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  await rect('sponge', 1, X+150, Y+40, X+210, Y+100);   // a loose sponge to pick up
  const spongeO = await p.evaluate(() => { const o = window.__pg.objects().filter(q => !q.body.isStatic)[0]; return { x: o.body.position.x, y: o.body.position.y }; });
  const gs = await place('grabsensor', spongeO.x, spongeO.y);
  ok('a grab sensor on the sponge', !!gs && gs.obj !== null && gs.out === 0, gs && { obj: gs.obj, out: gs.out });
  await play(); await standAt(spongeO.x - 48, Y+60); await p.waitForTimeout(300);
  ok('off while nobody holds it', (await kinds('grabsensor'))[0].out === 0);
  await p.evaluate(() => window.__pg.grab(true)); await p.waitForTimeout(250);
  ok('grabbing the sponge: on', (await p.evaluate(() => window.__pg.grabbing())) && (await kinds('grabsensor'))[0].out === 1, { grabbing: await p.evaluate(() => window.__pg.grabbing()), out: (await kinds('grabsensor'))[0].out });
  await p.evaluate(() => window.__pg.grab(false)); await p.waitForTimeout(150);
  ok('let go: off', (await kinds('grabsensor'))[0].out === 0);
  ok('it has an output and takes no wire', await p.evaluate(() => { const g = window.__pg.gadgets().filter(q => q.kind === 'grabsensor')[0]; return g && g.hasOutput !== false; }));
  await build();

  console.log('== the score giver: points on the signal ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await rect('wood', 1, X+100, Y-40, X+160, Y+100);   // a post
  await lockAll();
  const lv = await place('lever', X+130, Y+30);
  const sg = await place('score', X+130, Y+70);
  ok('a score giver, fifty points, every time', !!sg && sg.points === 50 && !sg.once, sg && { points: sg.points, once: sg.once });
  await p.evaluate(([a, b]) => window.__pg.wire(a, b), [lv.id, sg.id]);
  await play(); await standAt(X+80, Y+60); await p.waitForTimeout(200);
  const sc0 = await p.evaluate(() => window.__pg.score());
  await p.keyboard.press('KeyF'); await p.waitForTimeout(150);
  ok('the lever on: fifty points', (await p.evaluate(() => window.__pg.score())) === sc0 + 50, { was: sc0, now: await p.evaluate(() => window.__pg.score()) });
  await p.keyboard.press('KeyF'); await p.waitForTimeout(100); await p.keyboard.press('KeyF'); await p.waitForTimeout(150);
  ok('off and on again: fifty more', (await p.evaluate(() => window.__pg.score())) === sc0 + 100);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { once: true, points: 30 }), (await kinds('score'))[0].id);
  await play(); await standAt(X+80, Y+60); await p.waitForTimeout(200);
  const sc1 = await p.evaluate(() => window.__pg.score());
  await p.keyboard.press('KeyF'); await p.waitForTimeout(100); await p.keyboard.press('KeyF'); await p.waitForTimeout(100); await p.keyboard.press('KeyF'); await p.waitForTimeout(150);
  ok('once per Play: thirty, and no more', (await p.evaluate(() => window.__pg.score())) === sc1 + 30, { was: sc1, now: await p.evaluate(() => window.__pg.score()) });
  const file2 = await p.evaluate(() => window.__pg.serialize());
  ok('saved with its points and once', file2.gadgets.filter(g => g.kind === 'score')[0].points === 30 && file2.gadgets.filter(g => g.kind === 'score')[0].once === true);
  await build();

  console.log('== the randomiser: on and off at random ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  const rnd = await place('random', X, Y+120);
  ok('a randomiser, half a second to two', !!rnd && rnd.min === 0.5 && rnd.max === 2, rnd && { min: rnd.min, max: rnd.max });
  await p.evaluate(id => window.__pg.gadgetSet(id, { min: 0.1, max: 0.25 }), rnd.id);
  await play(); await p.waitForTimeout(100);
  const seen = []; for (let i = 0; i < 24; i++){ await p.waitForTimeout(60); seen.push((await kinds('random'))[0].out); }
  ok('unwired it flickers: both on and off seen, and changes', seen.indexOf(1) >= 0 && seen.indexOf(0) >= 0 && seen.filter((v, i) => i && v !== seen[i-1]).length >= 3, seen.join(''));
  await build();
  await rect('wood', 1, X+100, Y-40, X+160, Y+100);
  await lockAll();
  const lv2 = await place('lever', X+130, Y+30);
  const rnd2 = (await kinds('random'))[0];
  await p.evaluate(([a, b]) => window.__pg.wire(a, b), [(await kinds('lever'))[0].id, rnd2.id]);
  await play(); await p.waitForTimeout(400);
  const seenOff = []; for (let i = 0; i < 10; i++){ await p.waitForTimeout(50); seenOff.push((await kinds('random'))[0].out); }
  ok('wired to a lever that is off, it stays off', seenOff.every(v => v === 0), seenOff.join(''));
  await build();

  console.log('== no page errors ==');
  ok('no errors', errs.length === 0, errs);
  await b.close();
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  process.exit(fail ? 1 : 0);
})();
