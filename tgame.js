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

  console.log('== a saved object keeps its gadgets and their wires; placed, emitted or fired, they come too ==');
  await fresh();
  await p.evaluate(() => { localStorage.removeItem('pg_my_objects'); });
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);   // floor
  await rect('metal', 1, X-60, Y-20, X+60, Y+100);     // the thing to save: a crate with a sensor wired to a speech bubble and a tag
  await lockAll();
  const crate = await p.evaluate(() => window.__pg.objects().filter(o => o.pieces[0].m === 'metal')[0].id);
  const cs = await place('sensor', X-30, Y+40), csp = await place('speech', X+30, Y+20), ctag = await place('tag', X, Y+80);
  await set(csp.id, 'text', 'I came with the crate');
  await set(ctag.id, 'color', 3);
  await wire(cs.id, csp.id);
  // and a wire OUT to something not on the crate, which must not be kept
  const outside = await place('sound', X-300, Y+120);
  await wire(cs.id, outside.id);
  await p.evaluate(id => { const o = window.__pg.objects().filter(o => o.id === id)[0]; window.__pg.select(o); window.__pg.saveSelectedAs('Wired crate'); }, crate);
  await p.waitForTimeout(200);
  let saved = await p.evaluate(() => window.__pg.savedObjectsFull());
  const sv = saved.filter(s => s.name === 'Wired crate')[0];
  ok('the saved object carries its three gadgets', sv && sv.gadgets.length === 3 && sv.gadgets.map(g => g.kind).sort().join() === 'sensor,speech,tag', sv && sv.gadgets.map(g => g.kind));
  ok('with their settings', sv && sv.gadgets.filter(g => g.kind === 'speech')[0].text === 'I came with the crate' && sv.gadgets.filter(g => g.kind === 'tag')[0].color === 3);
  ok('placed relative to the object, not the map', sv && sv.gadgets.every(g => Math.abs(g.x) < 100 && Math.abs(g.y) < 100), sv && sv.gadgets.map(g => [g.x, g.y]));
  ok('and the wire between them, not the one leading out', sv && sv.wires.length === 1, sv && sv.wires);
  // place a copy
  const nG = (await gadgets()).length, nO = await objs();
  await p.evaluate(([id, x, y]) => window.__pg.stamp(id, x, y), [sv.id, X+250, Y+40]);
  await p.waitForTimeout(200);
  ok('placing it makes the object and its gadgets', (await objs()) === nO + 1 && (await gadgets()).length === nG + 3, [(await objs()) - nO, (await gadgets()).length - nG]);
  const copySpeech = (await kinds('speech')).slice(-1)[0], copySensor = (await kinds('sensor')).slice(-1)[0];
  ok('the copy sits on the new object, its gadgets in the same places on it', copySpeech.obj !== null && copySpeech.obj === copySensor.obj && Math.abs((copySpeech.x - copySensor.x) - 60) < 3 && Math.abs((copySpeech.y - copySensor.y) + 20) < 3, [copySpeech.x - copySensor.x, copySpeech.y - copySensor.y]);
  const ws2 = await p.evaluate(() => window.__pg.wires());
  ok('wired the same: the copy has its sensor wired to its bubble', ws2.some(w => w.from === copySensor.id && w.to === copySpeech.id) && ws2.length === 3, ws2);
  await lockAll();
  await play();
  await standAt(X+150, Y+60);   // beside the copy, within its sensor's reach
  const cps = (await kinds('speech')).filter(g => g.text === 'I came with the crate');
  ok('walk up to the copy and it speaks — the wire came with it', cps.length === 2 && cps.some(g => g.showing === true), cps.map(g => g.showing));
  await build();
  // an emitter fires the whole thing
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await rect('wood', 1, X-380, Y-200, X-300, Y-140);   // a pedestal for the emitter
  await lockAll();
  const em = await place('objemitter', X-340, Y-170);
  await p.evaluate(([id, name]) => { const g = window.__pg.gadgets().filter(g => g.kind === 'objemitter')[0]; window.__pg.emitterUse(g.id, name); }, [em.id, 'Wired crate']);
  const emG = await byId(em.id);
  ok('the emitter captures the object with its gadgets', !!emG && emG.emitName === 'Wired crate', emG && emG.emitName);
  await set(em.id, 'freq', 0.3); await set(em.id, 'maxAlive', 2);
  const nBase = await objs();   // the starter floor, the floor, the pedestal
  await play(); await p.waitForTimeout(900);
  const fired = await kinds('speech');
  ok('what it fires comes out with its speech bubble and sensor', fired.length >= 1 && (await kinds('sensor')).length >= 1 && fired.every(g => g.obj !== null), fired.length);
  const level = await p.evaluate(() => window.__pg.serialize('emitted'));
  ok('the level file leaves the fired copies out, gadgets included', level.gadgets.filter(g => g.kind === 'speech').length === 0 && level.objects.length === nBase, [level.gadgets.length, level.objects.length, nBase]);
  ok('but the emitter keeps the whole object to fire', level.gadgets.filter(g => g.kind === 'objemitter')[0].emit.gadgets.length === 3);
  await build();
  ok('Build has none of the fired copies', (await kinds('speech')).length === 0 && (await objs()) === nBase);
  // a Play entered from a running Build does not keep what was fired
  await p.evaluate(() => window.__pg.paused(false)); await p.waitForTimeout(900);
  ok('unpaused Build fires them too', (await kinds('speech')).length >= 1);
  await p.evaluate(() => window.__pg.setMode('play')); await p.waitForTimeout(200);
  await build();
  ok('and coming back from Play, the fired copies are gone rather than kept', (await kinds('speech')).length === 0 && (await objs()) === nBase, [(await kinds('speech')).length, await objs()]);
  // save and load keep the emitter's capture
  const data2 = await p.evaluate(() => window.__pg.serialize('emitter with logic'));
  await fresh();
  await p.evaluate(d => window.__pg.load(d), data2); await p.waitForTimeout(200);
  const em2 = (await kinds('objemitter'))[0];
  ok('a loaded level\'s emitter still fires the whole thing', !!em2 && em2.emitName === 'Wired crate' && (await p.evaluate(() => { const g = window.__pg.gadgets().filter(g => g.kind === 'objemitter')[0]; return window.__pg.emitState ? window.__pg.emitState(g.id) : null; })) !== undefined);
  await play(); await p.waitForTimeout(700);
  ok('…gadgets and all', (await kinds('speech')).length >= 1);
  await build();

  console.log('== a drawn creature saved as an object comes out of an emitter as a creature ==');
  await fresh();
  const st = (cmd, a, b2) => p.evaluate(([c, x, y]) => window.__pg.studio(c, x, y), [cmd, a, b2]);
  const stroke = async (x0, y0, x1, y1) => { const r = await st('canvasRect'); await p.mouse.move(r.x + r.w * x0, r.y + r.h * y0); await p.mouse.down(); await p.mouse.move(r.x + r.w * x1, r.y + r.h * y1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(60); };
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('creature'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X, Y+40]); await p.waitForTimeout(200);
  await st('go', 'idle', 0); await st('setColor', '#C89BD9'); await stroke(0.2, 0.3, 0.8, 0.7);
  await st('go', 'hitbox', 0); await stroke(0.5, 0.25, 0.5, 0.75);
  await st('go', 'dangerD', 0); await stroke(0.5, 0.6, 0.5, 0.75);
  await st('close'); await p.waitForTimeout(200);
  const cr0 = (await kinds('creature'))[0];
  ok('a drawn creature stands on the level', !!cr0 && cr0.hasSkin && cr0.hitStrokes === 1 && cr0.dangerArea > 20, cr0 && { skin: cr0.hasSkin, hit: cr0.hitStrokes, danger: cr0.dangerArea });
  await p.evaluate(id => { const o = window.__pg.objects().filter(o => o.id === id)[0]; window.__pg.select(o); window.__pg.saveSelectedAs('Blob'); window.__pg.deselect(); }, cr0.obj);
  const svc = (await p.evaluate(() => window.__pg.savedObjectsFull())).filter(s => s.name === 'Blob')[0];
  ok('saved with its creature gadget, art box and painted danger', !!svc && svc.gadgets.length === 1 && svc.gadgets[0].kind === 'creature' && svc.gadgets[0].hasArt, svc && svc.gadgets);
  await rect('wood', 1, X-380, Y-200, X-300, Y-140);
  await lockAll();
  const em3 = await place('objemitter', X-340, Y-170);
  await p.evaluate(id => window.__pg.emitterUse(id, 'Blob'), em3.id);
  await set(em3.id, 'freq', 0.3); await set(em3.id, 'maxAlive', 1); await set(em3.id, 'speed', 0);
  await play(); await standAt(X+300, Y+60); await p.waitForTimeout(800);
  const crs = await kinds('creature');
  const born = crs.filter(g => g.obj !== cr0.obj);
  ok('the emitter fires a creature: gadget, skin, hitbox, danger, art box', born.length >= 1 && born.every(g => g.hasSkin && g.dangerArea > 20 && g.art && g.art.w > 100), born.map(g => ({ skin: g.hasSkin, danger: g.dangerArea, art: g.art })));
  const bornObj = born[0] && await p.evaluate(id => { const o = window.__pg.objects().filter(o => o.id === id)[0]; return o ? { emitted: !!o.emitted, m: o.pieces[0].m, w: Math.round(o.body.bounds.max.x - o.body.bounds.min.x), h: Math.round(o.body.bounds.max.y - o.body.bounds.min.y), x: o.body.position.x } : null; }, born[0].obj);
  ok('its body is the drawn hitbox, narrow and tall, and it is marked as fired', bornObj && bornObj.emitted && bornObj.w < bornObj.h && bornObj.w < 60, bornObj);
  const x0 = bornObj.x;
  await p.waitForTimeout(700);
  const x1 = await p.evaluate(id => { const o = window.__pg.objects().filter(o => o.id === id)[0]; return o ? o.body.position.x : null; }, born[0].obj);
  ok('and it chases the player like the one it was saved from', x1 !== null && x1 > x0 + 20, { x0, x1 });
  await build();

  console.log('== the rocket pushes what it is stuck to ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  await rect('wood', 1, X-40, Y+20, X+40, Y+100);   // a loose crate on the floor
  const crateR = await p.evaluate(() => window.__pg.objects().filter(o => !o.body.isStatic)[0].id);
  const rk = await place('rocket', X, Y+60);
  ok('a rocket sits on the crate, pushing up at 1×', !!rk && rk.obj === crateR && rk.angle === 0 && rk.strength === 1, rk && { obj: rk.obj, angle: rk.angle, strength: rk.strength });
  const y0 = (await p.evaluate(id => window.__pg.objVel(id), crateR)).y;
  await play(); await p.waitForTimeout(600);
  const v1 = await p.evaluate(id => window.__pg.objVel(id), crateR);
  ok('in Play it lifts the crate off the floor', v1 && v1.y < y0 - 60, { y0, y1: v1 && v1.y });
  ok('and shows it firing', (await G('rocket')).firing === true);
  await build();
  const crateNow = () => p.evaluate(() => { const o = window.__pg.objects().filter(o => !o.body.isStatic)[0]; return o ? { vx: o.body.velocity.x, vy: o.body.velocity.y, x: o.body.position.x, y: o.body.position.y } : null; });   // ids renumber on a mode switch
  await p.evaluate(id => window.__pg.gadgetSet(id, { angle: 90 }), (await G('rocket')).id);
  await play(); await p.waitForTimeout(600);
  const v2 = await crateNow();
  ok('pointed right, it pushes the crate along the floor', v2 && v2.x > X + 60, v2 && v2.x);
  await build();
  const senR = await place('sensor', X-350, Y+120);
  await wire(senR.id, (await G('rocket')).id);
  await play(); await standAt(X+300, Y+60); await p.waitForTimeout(400);
  ok('wired to a sensor that is off, it does not fire', (await G('rocket')).firing === false && Math.abs((await crateNow()).vx) < 1);
  await build();
  const savedR = await p.evaluate(() => window.__pg.serialize('r'));
  ok('the level file carries the rocket', savedR.gadgets.filter(g => g.kind === 'rocket')[0].angle === 90 && savedR.gadgets.filter(g => g.kind === 'rocket')[0].strength === 1);

  console.log('== too fast or too hard: capped, and a glued thing comes apart ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  await rect('wood', 1, X-60, Y+40, X, Y+100);      // two materials glued into one thing, resting on the floor
  await rect('metal', 1, X-6, Y+40, X+60, Y+100);   // overlapping the wood a touch, so they weld
  const glued = await p.evaluate(() => window.__pg.objects().filter(o => !o.body.isStatic && o.pieces.length === 2)[0]);
  ok('a wood-and-metal thing, one object', !!glued);
  const bk0 = (await p.evaluate(() => window.__pg.bangs())).breaks;
  await play(); await p.waitForTimeout(200);
  const gid = (await p.evaluate(() => window.__pg.objects().filter(o => !o.body.isStatic && o.pieces.length === 2).map(o => o.id)))[0];
  await p.evaluate(id => window.__pg.flingObj(id, 20, -5, 0), gid); await p.waitForTimeout(150);
  ok('flung hard but under the limit, it holds together', (await p.evaluate(() => window.__pg.bangs())).breaks === bk0 && (await p.evaluate(id => window.__pg.objVel(id), gid)) !== null);
  await p.evaluate(id => window.__pg.flingObj(id, 60, -10, 0), gid); await p.waitForTimeout(150);
  ok('flung past the limit, it comes apart into its two materials', (await p.evaluate(() => window.__pg.bangs())).breaks === bk0 + 1 && (await p.evaluate(id => window.__pg.objVel(id), gid)) === null && (await p.evaluate(() => window.__pg.objects().filter(o => !o.body.isStatic).length)) >= 2, await p.evaluate(() => window.__pg.bangs()));
  const fast = await p.evaluate(() => window.__pg.objects().filter(o => !o.body.isStatic).map(o => Math.hypot(o.body.velocity.x, o.body.velocity.y)));
  ok('and nothing goes faster than the cap', fast.every(v => v <= 48.5), fast);
  await build();

  console.log('== squashed: between two things, or inside one; not by a landing ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await rect('metal', 1, X+100, Y-200, X+140, Y+100);   // a wall to be pressed against
  await lockAll();
  await rect('metal', 1, X-300, Y-60, X-200, Y+100);   // a heavy block to push into the player
  await p.evaluate(() => { const o = window.__pg.objects().filter(o => !o.body.isStatic)[0]; window.__pg.select(o); window.__pg.anchor(); window.__pg.deselect(); });
  const pusher = (await p.evaluate(() => window.__pg.objects().filter(o => o.pieces[0].m === 'metal' && o.body.bounds.min.x < 300)))[0];
  const mvP = await place('mover', X-250, Y+20);
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+90, Y+20]);   // its run: right up to the wall
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 260 }), (await G('mover')).id);
  const cq0 = (await p.evaluate(() => window.__pg.bangs())).crushes;
  await play(); await standAt(X+60, Y+60);   // standing against the wall, in the block's path
  await p.waitForTimeout(2200);
  const cq1 = (await p.evaluate(() => window.__pg.bangs())).crushes;
  ok('pressed into the wall by the block, the character is squashed', cq1 > cq0, { cq0, cq1 });
  const ppC = await pos();
  ok('and goes back to the start', Math.abs(ppC.x - (X+60)) > 150, ppC);
  await build();
  // a plain drop onto the floor is not a crush
  const cq2 = (await p.evaluate(() => window.__pg.bangs())).crushes;
  await play(); await standAt(X-100, Y-300); await p.waitForTimeout(900);
  ok('a fall onto the floor is not a crush', (await p.evaluate(() => window.__pg.bangs())).crushes === cq2);
  // inside a thing: a wall painted over the character in Build, unpaused
  await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(200);
  await standAt(X-100, Y+60);
  const cq3 = (await p.evaluate(() => window.__pg.bangs())).crushes;
  await rect('wood', 1, X-160, Y-20, X-40, Y+100);   // painted right over them
  await lockAll();
  await p.evaluate(() => window.__pg.paused(false)); await p.waitForTimeout(500);
  ok('ending up inside a thing, with the world running in Build, squashes too', (await p.evaluate(() => window.__pg.bangs())).crushes > cq3);
  await p.evaluate(() => window.__pg.paused(true));

  ok('no page errors', errs.length === 0, errs);
  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
