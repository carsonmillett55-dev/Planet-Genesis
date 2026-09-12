/* LBP2's logic: tags and tag sensors, impact sensors, timers and counters,
   and the reset wire.  node tlogic.js */
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
  const kind = (k) => gadgets().then(gs => gs.filter(g => g.kind === k)[0]);
  const kinds = (k) => gadgets().then(gs => gs.filter(g => g.kind === k));
  const stats = () => p.evaluate(() => window.__pg.stats());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(true); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const build = async () => { await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(300); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };
  const idOf = async (k, i) => (await kinds(k))[i || 0].id;   // ids are renumbered on a mode switch: never keep one across build()/play()
  const place = async (k, x, y) => { await p.evaluate(kk => { window.__pg.setLayer(1); window.__pg.setTool(kk); }, k); await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [x,y]); return kinds(k).then(gs => gs[gs.length - 1]); };

  console.log('== a tag and a tag sensor: colour, reach, closeness, wired tags ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);            // floor
  await rect('sponge', 1, X-40, Y+40, X+40, Y+100);              // a loose crate wearing a tag
  await lockAll();
  const tag = await place('tag', X, Y+70);
  ok('the Tag tool puts a tag on the crate', !!tag && tag.color === 0, tag && tag.color);
  const ts = await place('tagsensor', X+200, Y+110);
  ok('and the Tag sensor tool a sensor on the floor, reach 300', !!ts && ts.radius === 300 && ts.color === 0, ts && { r: ts.radius, c: ts.color });
  await play();
  ok('the sensor hears the red tag 200px away', (await kind('tagsensor')).out === 1, (await kind('tagsensor')).out);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { color: 3 }), await idOf('tagsensor'));
  await play();
  ok('set to green it does not hear a red tag', (await kind('tagsensor')).out === 0);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { color: 0, radius: 120 }), await idOf('tagsensor'));
  await play();
  ok('nor a red one out of reach', (await kind('tagsensor')).out === 0);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { radius: 400, analog: true }), await idOf('tagsensor'));
  await play();
  const cl = (await kind('tagsensor')).out;
  ok('closeness: a tag half way out gives about half a signal', cl > 0.35 && cl < 0.65, cl);
  await build();
  // a tag wired to a lever is worn only while the lever is on
  const lv = await place('lever', X-300, Y+110);
  await p.evaluate(([a,b]) => window.__pg.wire(a,b), [await idOf('lever'), await idOf('tag')]);
  await p.evaluate(id => window.__pg.gadgetSet(id, { analog: false }), await idOf('tagsensor'));
  await play();
  ok('a tag wired to a lever that is off is not worn: the sensor hears nothing', (await kind('tag')).out === 0 && (await kind('tagsensor')).out === 0, { tag: (await kind('tag')).out, sensor: (await kind('tagsensor')).out });
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), await idOf('lever'));
  await play();
  ok('lever on, the tag is worn and heard', (await kind('tag')).out === 1 && (await kind('tagsensor')).out === 1);
  await build();

  console.log('');
  console.log('== an impact sensor: a pulse on a hit, on while touching, the player only, a tag required ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  await rect('metal', 1, X-40, Y-300, X+40, Y-220);              // a block dropped onto the floor
  const imp = await place('impact', X, Y+110);                   // on the floor
  ok('the Impact sensor tool puts one on the floor', !!imp && imp.touching === false);
  await play();
  const outs = [];
  for (let i = 0; i < 16; i++){ await p.waitForTimeout(50); outs.push((await kind('impact')).out); }
  ok('the block landing on the floor pulses it', outs.some(o => o === 1) && outs.slice(-3).every(o => o === 0), outs);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { touching: true }), await idOf('impact'));
  await play(); await p.waitForTimeout(700);
  ok('set to touching, it stays on while the block rests on the floor', (await kind('impact')).out === 1, (await kind('impact')).out);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { playerOnly: true }), await idOf('impact'));
  await play(); await p.waitForTimeout(500);
  ok('the player only: the resting block does not count', (await kind('impact')).out === 0);
  await standAt(X+200, Y+72); await p.waitForTimeout(400);
  ok('but the player standing on the floor does', (await kind('impact')).out === 1, (await kind('impact')).out);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { playerOnly: false, requireTag: true, tagColor: 4 }), await idOf('impact'));
  await play(); await p.waitForTimeout(500);
  ok('requiring a blue tag: the untagged block does not count', (await kind('impact')).out === 0);
  await build();
  const blk = (await stats()).filter(o => o.pieces[0].indexOf('metal') === 0)[0];
  await place('tag', blk.pos.x, blk.pos.y);
  await p.evaluate(id => window.__pg.gadgetSet(id, { color: 4 }), await idOf('tag'));
  await play(); await p.waitForTimeout(600);
  ok('give the block a blue tag and it does', (await kind('impact')).out === 1, (await kind('impact')).out);
  await build();

  console.log('');
  console.log('== a timer: up, up and down, down; reset ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  const tm = await place('timer', X, Y+110);
  const lv2 = await place('lever', X-300, Y+110);
  await p.evaluate(([a,b]) => window.__pg.wire(a,b), [await idOf('lever'), await idOf('timer')]);
  await p.evaluate(id => window.__pg.gadgetSet(id, { target: 2 }), await idOf('timer'));
  await play(); await p.waitForTimeout(500);
  ok('a timer wired to a lever that is off stays at nought', (await kind('timer')).time === 0 && (await kind('timer')).out === 0, (await kind('timer')).time);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), await idOf('lever'));
  await play(); await p.waitForTimeout(500);
  const mid = (await kind('timer')).time;
  ok('lever on, it counts up in real seconds (0.9s after 0.9s)', mid > 0.7 && mid < 1.15 && (await kind('timer')).out === 0, mid);
  await p.waitForTimeout(1300);
  ok('and at the target its output comes on, and holds', (await kind('timer')).out === 1 && Math.abs((await kind('timer')).time - 2) < 0.01, (await kind('timer')).time);
  await build();
  // up and down: off, it runs back
  await p.evaluate(id => window.__pg.gadgetSet(id, { mode: 'updown', time: 0 }), await idOf('timer'));
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), await idOf('lever'));
  await play(); await p.waitForTimeout(2000);
  ok('up-and-down: full while the lever is on', (await kind('timer')).out === 1);
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: false }), await idOf('lever'));
  await p.waitForTimeout(600);
  const back = (await kind('timer')).time;
  ok('lever off, it runs back down', back < 1.6 && (await kind('timer')).out === 0, back);
  await build();
  // a reset wire: a second lever puts it back to the start
  await p.evaluate(id => window.__pg.gadgetSet(id, { mode: 'up', time: 0 }), await idOf('timer'));
  await place('lever', X+300, Y+110);
  ok('a reset wire can be made to a timer', await p.evaluate(([a,b]) => window.__pg.wire(a,b,'reset'), [await idOf('lever', 1), await idOf('timer')]));
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), await idOf('lever', 0));
  await play(); await p.waitForTimeout(2000);
  ok('(full again)', (await kind('timer')).out === 1);
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), await idOf('lever', 1));
  await p.waitForTimeout(100);
  ok('the reset lever on puts it back to nought and holds it there', (await kind('timer')).time < 0.05 && (await kind('timer')).out === 0, (await kind('timer')).time);
  await build();
  const svT = await p.evaluate(() => window.__pg.serialize('t'));
  ok('the level file keeps the timer, its mode, and the reset wire as a reset', svT.gadgets.some(g => g.kind === 'timer' && g.target === 2 && g.mode === 'up') && svT.wires.some(w => w.port === 'reset'), svT.wires);
  await p.evaluate(d => window.__pg.load(d), svT); await p.waitForTimeout(200);
  ok('and it comes back wired the same', (await p.evaluate(() => window.__pg.serialize('t').wires)).filter(w => w.port === 'reset').length === 1);

  console.log('');
  console.log('== a counter: rising edges up to the target, then on; reset ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  const cn = await place('counter', X, Y+110);
  const lv4 = await place('lever', X-300, Y+110);
  await p.evaluate(([a,b]) => window.__pg.wire(a,b), [await idOf('lever'), await idOf('counter')]);
  await p.evaluate(id => window.__pg.gadgetSet(id, { target: 3 }), await idOf('counter'));
  await play();
  const flip = async (v) => { await p.evaluate(([id, v]) => window.__pg.gadgetSet(id, { on: v }), [await idOf('lever', 0), v]); await p.waitForTimeout(80); };
  await flip(true); await flip(false);
  ok('one flip of the lever counts one', (await kind('counter')).count === 1 && (await kind('counter')).out === 0, (await kind('counter')).count);
  await flip(true); await p.waitForTimeout(300);
  ok('holding it on counts no more', (await kind('counter')).count === 2);
  await flip(false); await flip(true);
  ok('the third flip reaches the target and the output comes on', (await kind('counter')).count === 3 && (await kind('counter')).out === 1);
  await flip(false); await flip(true);
  ok('and stays there, counting no further', (await kind('counter')).count === 3 && (await kind('counter')).out === 1);
  await build();
  await place('lever', X+300, Y+110);
  await p.evaluate(([a,b]) => window.__pg.wire(a,b,'reset'), [await idOf('lever', 1), await idOf('counter')]);
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: false }), await idOf('lever', 0));
  await play();
  await flip(true); await flip(false); await flip(true); await flip(false); await flip(true);
  ok('(at the target again)', (await kind('counter')).out === 1);
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), await idOf('lever', 1)); await p.waitForTimeout(100);
  ok('the reset wire puts it back to nought', (await kind('counter')).count === 0 && (await kind('counter')).out === 0);
  await build();
  await play();
  ok('entering Play starts every counter at nought', (await kind('counter')).count === 0);
  await build();

  console.log('');
  console.log('== an object emitter: copies of a saved object, flung, living a while; wired; not the level ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  await rect('sponge', 1, X-300, Y+40, X-240, Y+100);           // the thing to save
  await p.evaluate(() => { const o = window.__pg.objects().slice(-1)[0]; window.__pg.select(o); window.__pg.saveSelectedAs('Crate'); window.__pg.deselect(); });
  await p.evaluate(() => { const o = window.__pg.objects().slice(-1)[0]; window.__pg.select(o); window.__pg.anchor(); window.__pg.deselect(); });
  const em = await place('objemitter', X, Y+110);
  ok('the Object emitter tool puts one on the floor, firing nothing yet', !!em && em.emitName === null && em.freq === 2, em && { name: em.emitName, freq: em.freq });
  const saved = await p.evaluate(() => window.__pg.savedObjects());
  ok('a saved object can be given to it', await p.evaluate(([id, sid]) => window.__pg.emitterUse(id, sid), [await idOf('objemitter'), saved[0].id]));
  await p.evaluate(id => window.__pg.gadgetSet(id, { freq: 0.5, life: 2, maxAlive: 3, speed: 400, angle: 0 }), await idOf('objemitter'));
  const nObj = (await stats()).length;
  await play(); await p.waitForTimeout(700);
  let emitted = await p.evaluate(() => window.__pg.emitted());
  ok('in Play it fires a copy every half second, flung upward', emitted.length >= 1 && emitted.length <= 3 && emitted.every(e => e.pos.y < Y + 100), emitted);
  await p.waitForTimeout(1300);
  emitted = await p.evaluate(() => window.__pg.emitted());
  ok('never more than three alive', emitted.length <= 3 && emitted.length >= 2, emitted.length);
  await p.waitForTimeout(2500);
  ok('and each lives two seconds, so the oldest have gone', (await p.evaluate(() => window.__pg.emitted())).length <= 3);
  const sv2 = await p.evaluate(() => window.__pg.serialize('em'));
  ok('what it fired is not in the level file; the emitter and its object are', sv2.objects.length === nObj && sv2.gadgets.some(g => g.kind === 'objemitter' && g.emit && g.emit.name === 'Crate' && g.emit.pieces.length === 1), { objs: sv2.objects.length, was: nObj });
  await build();
  ok('back in Build, paused, nothing emitted remains', (await p.evaluate(() => window.__pg.emitted())).length === 0);
  // wired, one per signal
  await place('lever', X-350, Y+110);
  await p.evaluate(([a,b]) => window.__pg.wire(a,b), [await idOf('lever'), await idOf('objemitter')]);
  await p.evaluate(id => window.__pg.gadgetSet(id, { pulse: true }), await idOf('objemitter'));
  await play(); await p.waitForTimeout(600);
  ok('wired to a lever that is off, it fires nothing', (await p.evaluate(() => window.__pg.emitted())).length === 0);
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), await idOf('lever')); await p.waitForTimeout(300);
  ok('the lever coming on fires exactly one', (await p.evaluate(() => window.__pg.emitted())).length === 1);
  await p.waitForTimeout(800);
  ok('and only one while it stays on', (await p.evaluate(() => window.__pg.emitted())).length === 1);
  await build();
  await p.evaluate(d => window.__pg.load(d), sv2); await p.waitForTimeout(200);
  ok('the level loads with the emitter still holding its object', (await kind('objemitter')).emitName === 'Crate');

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
