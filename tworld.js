/* The Water sensor and the World changer: a sensor that is on under water,
   and a gadget that moves the world's light and water to its own values
   while its signal is on.  node tworld.js */
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
  const gadgets = () => p.evaluate(() => window.__pg.gadgets());
  const kind = (k) => gadgets().then(gs => gs.filter(g => g.kind === k)[0]);
  const live = () => p.evaluate(() => window.__pg.liveWorld());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(false); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const run = async () => { await p.evaluate(() => window.__pg.paused(false)); await p.waitForTimeout(200); };
  const ws = await p.evaluate(() => window.__pg.worldSize());

  console.log('');
  console.log('== the water sensor is on under water ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);          // floor
  await rect('wood', 1, X, Y-100, X+60, Y+100);               // a post
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('watersensor'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+30, Y]);   // half way up the post
  const wsn = await kind('watersensor');
  ok('a water sensor can be placed from the Tools', !!wsn, wsn);
  await run();
  ok('dry, it is off', (await kind('watersensor')).out === 0);
  await p.evaluate(y => window.__pg.worldSet('waterLevel', y), Y - 60);            // flood the world to above it
  await p.evaluate(() => window.__pg.paused(true)); await run();                    // (the live world takes the setting when it starts running)
  await p.waitForTimeout(200);
  ok('flooded past it, it is on', (await kind('watersensor')).out === 1, { out: (await kind('watersensor')).out, live: await live() });
  await p.evaluate(y => window.__pg.worldSet('waterLevel', y), Y + 60);            // water only up to below it
  await p.evaluate(() => window.__pg.paused(true)); await run();
  await p.waitForTimeout(200);
  ok('water below it, it is off again', (await kind('watersensor')).out === 0, { out: (await kind('watersensor')).out, live: await live() });
  await p.evaluate(() => window.__pg.worldSet('waterLevel', null));

  console.log('');
  console.log('== it needs water actually touching it, not a pool somewhere above ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);          // floor
  await rect('wood', 1, X-100, Y-60, X+200, Y-20);            // a shelf above, with walls, holding a pool
  await rect('wood', 1, X-100, Y-160, X-60, Y-60);
  await rect('wood', 1, X+160, Y-160, X+200, Y-60);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('watersensor'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+50, Y+102]);   // on the floor's top edge, under the shelf
  await p.evaluate(([x,y]) => window.__pg.pour(x, y, 50, 1), [X+50, Y-110]);   // fill the shelf
  await run(); await p.waitForTimeout(900);
  ok('a pool on a shelf above it leaves it off', (await kind('watersensor')).out === 0, { out: (await kind('watersensor')).out });
  await p.evaluate(([x,y]) => window.__pg.pour(x, y, 40, 1), [X+50, Y+70]);    // now pour on the floor, over it
  await p.waitForTimeout(500);
  ok('water on it turns it on', (await kind('watersensor')).out === 1, { out: (await kind('watersensor')).out });
  await p.evaluate(() => window.__pg.paused(true));
  // and on the Front layer, off an object there
  await fresh();
  await rect('wood', 2, X-100, Y+100, X+100, Y+140);       // a Front ledge to sit the sensor on
  await rect('wood', 1, X-100, Y+100, X+100, Y+140);       // and Mid ground at the same spot for the water to rest on (water is Mid's)
  await rect('wood', 1, X-380, Y+200, X+400, Y+240);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(2); window.__pg.setTool('watersensor'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X, Y+102]);
  ok('a water sensor goes on the Front layer', (await kind('watersensor')).layer === 2, await kind('watersensor'));
  await p.evaluate(([x,y]) => window.__pg.pour(x, y, 30, 1), [X, Y+80]);
  await run(); await p.waitForTimeout(400);
  ok('and reads the water at its spot there too', (await kind('watersensor')).out === 1);
  await p.evaluate(() => window.__pg.paused(true));

  console.log('');
  console.log('== the world changer dims the light while its signal is on ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('changer'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X, Y+120]);
  const ch = await kind('changer');
  ok('a world changer can be placed', !!ch && ch.setLight === true && ch.setWater === false && ch.secs === 2, ch);
  await p.evaluate(id => window.__pg.gadgetSet(id, { light: 0.2, secs: 0.5 }), ch.id);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('lever'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-200, Y+100]);
  const lv = await kind('lever');
  ok('a lever can be wired to it', await p.evaluate(([a,b]) => window.__pg.wire(a,b), [lv.id, ch.id]));
  await run(); await p.waitForTimeout(300);
  ok('lever off: the light is the level\'s own daylight', Math.abs((await live()).light - 1) < 0.01, await live());
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), lv.id);
  await p.waitForTimeout(250);
  const mid = (await live()).light;
  ok('lever on: the light is on its way down', mid < 0.9 && mid > 0.25, mid);
  await p.waitForTimeout(500);
  ok('and settles at the changer\'s value', Math.abs((await live()).light - 0.2) < 0.01, await live());
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: false }), lv.id);
  await p.waitForTimeout(800);
  ok('lever off again: back to daylight', Math.abs((await live()).light - 1) < 0.01, await live());
  ok('and the level\'s own setting was never touched', (await p.evaluate(() => window.__pg.worldGet('light'))) === 1);
  // latched: stays changed
  await p.evaluate(id => window.__pg.gadgetSet(id, { latch: true }), ch.id);
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), lv.id); await p.waitForTimeout(700);
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: false }), lv.id); await p.waitForTimeout(800);
  ok('set to stay changed, it stays dim after the lever goes off', Math.abs((await live()).light - 0.2) < 0.01, await live());
  await p.evaluate(() => window.__pg.paused(true)); await p.waitForTimeout(100);
  ok('pausing Build puts the world back as built', Math.abs((await live()).light - 1) < 0.01, await live());

  console.log('');
  console.log('== and floods the world ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('changer'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X, Y+120]);
  const fl = await kind('changer');
  await p.evaluate(([id, y]) => window.__pg.gadgetSet(id, { setLight: false, setWater: true, water: y, secs: 0.5 }), [fl.id, Y - 50]);   // unwired: on from the start
  ok('with no water in the level to begin with', (await live()).water === null);
  await run(); await p.waitForTimeout(900);
  const lw = await live();
  ok('an unwired changer set to water floods the world to its level', lw.water != null && Math.abs(lw.water - (Y - 50)) < 3, lw);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('watersensor'); });
  const sv = await p.evaluate(() => window.__pg.serialize('changer'));
  const gs = sv.gadgets.filter(g => g.kind === 'changer')[0];
  ok('the save carries the changer\'s settings', gs && gs.setWater === true && gs.setLight === false && Math.abs(gs.water - (Y - 50)) < 1 && gs.secs === 0.5, gs);
  await p.evaluate(() => window.__pg.paused(true));
  await p.evaluate(sv => window.__pg.load(sv), sv); await p.waitForTimeout(300);
  const back = await kind('changer');
  ok('and a load brings them back', back && back.setWater === true && Math.abs(back.water - (Y - 50)) < 1, back);
  ok('the level\'s own water is still none', (await p.evaluate(() => window.__pg.worldGet('waterLevel'))) === null && (await live()).water === null);

  console.log('');
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
