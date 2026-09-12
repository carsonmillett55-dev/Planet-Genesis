/* The gameplay gadgets: the speech bubble, the destroyer, the sound, and
   the logic gates.  node tgame.js */
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
  const idOf = async (k, i) => (await kinds(k))[i || 0].id;
  const byId = async (id) => (await gadgets()).filter(g => g.id === id)[0];
  const G = async (k, i) => (await kinds(k))[i || 0];   // ids renumber on a mode switch: read by kind and index
  const objs = () => p.evaluate(() => window.__pg.objects().length);
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
  const wire = (a, b2, port) => p.evaluate(([a, b2, port]) => window.__pg.wire(a, b2, port), [a, b2, port]);
  const set = (id, k, v) => p.evaluate(([id, k, v]) => { const o = {}; o[k] = v; return window.__pg.gadgetSet(id, o); }, [id, k, v]);

  console.log('== the tools are on their pages, with tips ==');
  const logicPage = await p.evaluate(() => { window.__pg.menu('toolsbag'); const pg = Array.from(document.querySelectorAll('#pmPages button')).filter(b => b.textContent.trim() === 'Logic')[0]; pg.click(); return document.getElementById('pmBody').innerText; });
  ok('Gate is on the Logic page', /Gate/.test(logicPage));
  const gamePage = await p.evaluate(() => { const pg = Array.from(document.querySelectorAll('#pmPages button')).filter(b => b.textContent.trim() === 'Gameplay')[0]; pg.click(); return document.getElementById('pmBody').innerText; });
  ok('Speech bubble, Destroyer and Sound are on the Gameplay page', /Speech bubble/.test(gamePage) && /Destroyer/.test(gamePage) && /Sound/.test(gamePage));
  await p.evaluate(() => window.__pg.menu(null));
  ok('each has a tip', await p.evaluate(() => ['tool:speech','tool:destroyer','tool:sound','tool:gate'].every(k => !!window.__pg.tipsTable()[k])));

  console.log('== the speech bubble: speaks while the player is near ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);   // floor
  await rect('wood', 1, X+150, Y-40, X+200, Y+100);    // a post to put it on
  await lockAll();
  const sp = await place('speech', X+175, Y);
  ok('placed on the post, with a line to say', !!sp && sp.obj !== null && sp.text === 'Hello there!' && sp.radius === 180, sp && { obj: sp.obj, text: sp.text });
  await set(sp.id, 'text', 'Mind the gap, friend.');
  await play();
  await standAt(X-300, Y+60);
  ok('far away, it says nothing', !(await G('speech')).showing);
  await standAt(X+80, Y+60);
  ok('near, it speaks', (await G('speech')).showing === true && (await G('speech')).text === 'Mind the gap, friend.');
  await standAt(X-300, Y+60);
  ok('and stops when they leave', !(await G('speech')).showing);
  await standAt(X+80, Y+60);
  ok('every time, by default', (await G('speech')).showing === true);
  await build();
  await set((await G('speech')).id, 'once', true);
  await play();
  await standAt(X+80, Y+60);
  ok('the first time only: it speaks once…', (await G('speech')).showing === true);
  await standAt(X-300, Y+60); await standAt(X+80, Y+60);
  ok('…and not the second', !(await G('speech')).showing);
  await build();
  await set((await G('speech')).id, 'once', false);
  await play();
  await standAt(X+80, Y+60);
  ok('a new Play starts it over', (await G('speech')).showing === true);
  await build();
  // wired: the signal decides, not the player
  const farSensor = await place('sensor', X-380, Y+120);
  await wire(farSensor.id, (await G('speech')).id);
  await play();
  await standAt(X+80, Y+60);
  ok('wired to a sensor that is off, it stays quiet even with the player beside it', !(await G('speech')).showing);
  await standAt(X-380, Y+60);
  ok('and speaks while the signal is on', (await G('speech')).showing === true);
  await build();

  console.log('== the destroyer: its host goes when the signal comes on, Play only, Build has it back ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);   // floor
  await rect('wood', 1, X+100, Y-60, X+260, Y+100);    // a wall to blow up
  await rect('metal', 1, X+330, Y+40, X+380, Y+100);   // a loose crate beside it
  await p.evaluate(() => { const os = window.__pg.objects(); [os[0], os[1]].forEach(o => { window.__pg.select(o); window.__pg.anchor(); }); window.__pg.deselect(); });
  const nObj = await objs();
  const dz = await place('destroyer', X+180, Y+20);
  ok('placed on the wall, exploding by default', !!dz && dz.obj !== null && dz.explode === true && dz.blast === 260, dz && { obj: dz.obj, explode: dz.explode });
  const trig = await place('sensor', X-300, Y+120);
  await wire(trig.id, dz.id);
  await play();
  await standAt(X+30, Y+60);
  ok('nothing happens until the signal', (await objs()) === nObj);
  const crateBefore = await p.evaluate(() => { const o = window.__pg.objects()[2]; return { x: o.body.position.x, y: o.body.position.y }; });
  await standAt(X-300, Y+60); await p.waitForTimeout(500);
  ok('the wall is gone the moment the signal comes on', (await objs()) === nObj - 1, await objs());
  ok('and the destroyer with it', (await kinds('destroyer')).length === 0);
  const crateAfter = await p.evaluate(() => { const o = window.__pg.objects().filter(o => o.pieces[0].m === 'metal')[0]; return o ? { x: o.body.position.x, y: o.body.position.y } : null; });
  ok('the bang shoved the loose crate away', crateAfter && Math.hypot(crateAfter.x - crateBefore.x, crateAfter.y - crateBefore.y) > 15, { crateBefore, crateAfter });
  await build();
  ok('Build has the wall back, destroyer and all', (await objs()) === nObj && (await kinds('destroyer')).length === 1);
  // vanish quietly, and nothing happens in Build unpaused
  await set(await idOf('destroyer'), 'explode', false);
  await p.evaluate(() => window.__pg.paused(false));
  await standAt(X-300, Y+60); await p.waitForTimeout(400);
  ok('in Build, unpaused, the signal destroys nothing', (await objs()) === nObj);
  await p.evaluate(() => window.__pg.paused(true));
  await play();
  const cb2 = await p.evaluate(() => { const o = window.__pg.objects().filter(o => o.pieces[0].m === 'metal')[0]; return { x: o.body.position.x, y: o.body.position.y }; });
  await standAt(X-300, Y+60); await p.waitForTimeout(500);
  const ca2 = await p.evaluate(() => { const o = window.__pg.objects().filter(o => o.pieces[0].m === 'metal')[0]; return o ? { x: o.body.position.x, y: o.body.position.y } : null; });
  ok('vanishing quietly takes the wall and leaves the crate where it was', (await objs()) === nObj - 1 && ca2 && Math.hypot(ca2.x - cb2.x, ca2.y - cb2.y) < 6, { cb2, ca2 });
  await build();

  console.log('== the sound: plays when its signal comes on, again every so often while it stays on ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  const snd = await place('sound', X+200, Y+120);
  ok('placed, a chime at full pitch', !!snd && snd.sound === 'chime' && snd.pitch === 1 && snd.every === 0, snd && { sound: snd.sound, pitch: snd.pitch });
  const near = await place('sensor', X-300, Y+120);
  await wire(near.id, snd.id);
  await set(snd.id, 'sound', 'boom'); await set(snd.id, 'pitch', 1.5);
  await play();
  await standAt(X+80, Y+60);
  ok('quiet until the signal', (await p.evaluate(() => window.__pg.lastSound())) === null);
  await standAt(X-300, Y+60);
  let ls = await p.evaluate(() => window.__pg.lastSound());
  ok('the signal plays the boom at its pitch', ls && ls.sound === 'boom' && ls.pitch === 1.5, ls);
  const at1 = ls.at;
  await p.waitForTimeout(500);
  ls = await p.evaluate(() => window.__pg.lastSound());
  ok('once — not again while it stays on', ls.at === at1);
  await build();
  await set((await G('sound')).id, 'every', 0.2);
  await play();
  await standAt(X-300, Y+60); await p.waitForTimeout(700);
  ls = await p.evaluate(() => window.__pg.lastSound());
  ok('with "again every 0.2s" it keeps playing while on', ls.at > at1 + 400, ls);
  await build();

  console.log('== gates: AND, OR, XOR, NOT, toggle ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  // an unwired tag is always on: a constant. A sensor with the player far away is off.
  const t1 = await place('tag', X-200, Y+120), t2 = await place('tag', X-150, Y+120);
  const off = await place('sensor', X+300, Y+120);
  const gate = await place('gate', X, Y+120);
  ok('a gate starts as AND', !!gate && gate.mode === 'and');
  await play(); await standAt(X-380, Y+60);
  ok('AND with nothing wired is off', (await G('gate')).out === 0);
  await build(); await wire((await G('tag', 0)).id, (await G('gate')).id); await wire((await G('tag', 1)).id, (await G('gate')).id); await play(); await standAt(X-380, Y+60);
  ok('AND of two constants that are on: on', (await G('gate')).out === 1 && (await G('gate')).inN === 2, await byId(gate.id));
  await build(); await wire((await G('sensor')).id, (await G('gate')).id); await play(); await standAt(X-380, Y+60);
  ok('one of three off: AND is off', (await G('gate')).out === 0 && (await G('gate')).inN === 3 && (await G('gate')).inOn === 2);
  await set((await G('gate')).id, 'mode', 'or');
  await p.waitForTimeout(100);
  ok('OR of the same: on', (await G('gate')).out === 1);
  await set((await G('gate')).id, 'mode', 'xor'); await p.waitForTimeout(100);
  ok('XOR with two on: off', (await G('gate')).out === 0);
  await standAt(X+300, Y+60);
  ok('XOR with all three on: off', (await G('gate')).out === 0 && (await G('gate')).inOn === 3);
  await set((await G('gate')).id, 'mode', 'not'); await p.waitForTimeout(100);
  ok('NOT with anything on: off', (await G('gate')).out === 0);
  await build();
  const not2 = await place('gate', X+60, Y+120);
  await set(not2.id, 'mode', 'not');
  await play(); await standAt(X-380, Y+60);
  ok('NOT with nothing wired: on', (await G('gate', 1)).out === 1);
  await build(); await wire((await G('sensor')).id, (await G('gate', 1)).id); await play(); await standAt(X-380, Y+60);
  ok('NOT of an off sensor: on', (await G('gate', 1)).out === 1);
  await standAt(X+300, Y+60);
  ok('…and off once the sensor is on', (await G('gate', 1)).out === 0);
  await build();
  const tog = await place('gate', X+120, Y+120);
  await set(tog.id, 'mode', 'toggle'); await wire((await G('sensor')).id, tog.id);
  await play(); await standAt(X-380, Y+60);
  ok('a toggle starts off', (await G('gate', 2)).out === 0);
  await standAt(X+300, Y+60);
  ok('the signal coming on flips it on', (await G('gate', 2)).out === 1);
  await standAt(X-380, Y+60);
  ok('and it stays on when the signal drops', (await G('gate', 2)).out === 1);
  await standAt(X+300, Y+60);
  ok('the next rise flips it off', (await G('gate', 2)).out === 0);
  await build();
  await play();
  ok('a new Play starts the toggle off again', (await G('gate', 2)).out === 0 && (await G('gate', 2)).state === false);
  await build();
  // a gate drives things like any switch: wire it to a speech bubble
  const sp2 = await place('speech', X-100, Y+120);
  await wire((await G('gate', 2)).id, sp2.id);
  await play(); await standAt(X+300, Y+60); await p.waitForTimeout(100);
  ok('a gate drives a speech bubble', (await G('speech')).showing === true);
  await build();

  console.log('== save and load carry all of it ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  const a1 = await place('speech', X-200, Y+120); await set(a1.id, 'text', 'Saved line'); await set(a1.id, 'once', true); await set(a1.id, 'radius', 333);
  const a2 = await place('destroyer', X-100, Y+120); await set(a2.id, 'explode', false); await set(a2.id, 'blast', 500);
  const a3 = await place('sound', X, Y+120); await set(a3.id, 'sound', 'laser'); await set(a3.id, 'pitch', 0.75); await set(a3.id, 'every', 1.5);
  const a4 = await place('gate', X+100, Y+120); await set(a4.id, 'mode', 'xor');
  const data = await p.evaluate(() => window.__pg.serialize('gadgets'));
  await fresh();
  await p.evaluate(d => window.__pg.load(d), data); await p.waitForTimeout(300);
  const gs = await gadgets();
  const s1 = gs.filter(g => g.kind === 'speech')[0], s2 = gs.filter(g => g.kind === 'destroyer')[0], s3 = gs.filter(g => g.kind === 'sound')[0], s4 = gs.filter(g => g.kind === 'gate')[0];
  ok('the speech bubble keeps its line, once and reach', s1 && s1.text === 'Saved line' && s1.said === false && s1.radius === 333 && s1.obj !== null, s1 && [s1.text, s1.radius]);
  ok('the destroyer keeps its mode and blast', s2 && s2.explode === false && s2.blast === 500, s2 && [s2.explode, s2.blast]);
  ok('the sound keeps its sound, pitch and every', s3 && s3.sound === 'laser' && s3.pitch === 0.75 && s3.every === 1.5, s3 && [s3.sound, s3.pitch, s3.every]);
  ok('the gate keeps its mode', s4 && s4.mode === 'xor', s4 && s4.mode);
  ok('a bad sound name loads as the chime', await p.evaluate(d => { d.gadgets.forEach(g => { if (g.kind === 'sound') g.sound = 'nope'; if (g.kind === 'gate') g.mode = 'maybe'; }); window.__pg.load(d); const gs = window.__pg.gadgets(); return gs.filter(g => g.kind === 'sound')[0].sound === 'chime' && gs.filter(g => g.kind === 'gate')[0].mode === 'and'; }, data));

  ok('no page errors', errs.length === 0, errs);
  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
