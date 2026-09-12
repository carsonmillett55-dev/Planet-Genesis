/* The Fan: a column of air above it that lifts the player and loose
   objects; wired, it blows only while the signal is on; on a turned host it
   blows that way.  node tfan.js */
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

  console.log('== a fan on the floor lifts the player ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);            // floor
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('fan'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X, Y+110]);
  const fan = await kind('fan');
  ok('the tool puts a fan on the floor', !!fan && fan.width === 120 && fan.reach === 420, fan && { w: fan.width, r: fan.reach, s: fan.strength });
  await play();
  ok('it is on, unwired', (await kind('fan')).out === 1, (await kind('fan')).out);
  await standAt(X, Y+72); await p.waitForTimeout(900);
  const y1 = (await pos()).y;
  ok('standing over it you are lifted into the air', y1 < Y + 72 - 80, { stood: Y+72, now: y1 });
  ok('and hover inside its reach rather than flying off for good', y1 > Y + 100 - 420 - 40, y1);
  await standAt(X+300, Y+72); await p.waitForTimeout(600);
  ok('beside the column, nothing', Math.abs((await pos()).y - (Y+72)) < 12, (await pos()).y);
  await build();

  console.log('');
  console.log('== wired, it blows only while the signal is on; a loose crate rises too ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('fan'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X, Y+110]);
  await p.evaluate(() => { window.__pg.setTool('lever'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-300, Y+110]);
  await p.evaluate(([a,b]) => window.__pg.wire(a,b), [(await kind('lever')).id, (await kind('fan')).id]);
  await play();
  await standAt(X, Y+60); await p.waitForTimeout(700);
  ok('wired to a lever that is off, it does not blow', (await kind('fan')).out === 0 && (await pos()).y > Y + 40, { out: (await kind('fan')).out, y: (await pos()).y });
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), (await kind('lever')).id);
  await rect('sponge', 1, X-30, Y+40, X+30, Y+100);              // a loose crate in the column
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), (await kind('lever')).id);
  await play();
  await standAt(X+300, Y+60); await p.waitForTimeout(900);
  const crate = (await stats()).filter(o => o.pieces[0].indexOf('sponge') === 0)[0];
  ok('lever on: it blows, and the loose crate in the column floats up', (await kind('fan')).out === 1 && crate && crate.pos.y < Y + 70 - 60, { out: (await kind('fan')).out, crateY: crate && crate.pos.y });
  await build();
  const sv = await p.evaluate(() => window.__pg.serialize('fan'));
  const fs = sv.gadgets.filter(g => g.kind === 'fan')[0];
  ok('the level file carries its width, reach and strength', fs && fs.width === 120 && fs.reach === 420 && Math.abs(fs.strength - 0.9) < 0.001, fs && { w: fs.width, r: fs.reach, s: fs.strength });
  await p.evaluate(id => window.__pg.gadgetSet(id, { width: 300, reach: 900, strength: 1.4 }), (await kind('fan')).id);
  const sv2 = await p.evaluate(() => window.__pg.serialize('fan'));
  await p.evaluate(d => window.__pg.load(d), sv2); await p.waitForTimeout(300);
  const f2 = await kind('fan');
  ok('and the settings come back', f2 && f2.width === 300 && f2.reach === 900 && Math.abs(f2.strength - 1.4) < 0.001 && f2.obj, f2 && { w: f2.width, r: f2.reach, s: f2.strength });

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
