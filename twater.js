/* Water and the tools that take things away: the eraser works on the
   layer you are on, the vacuum takes water and nothing else, thin water
   dries up while a pool stays.  node twater.js */
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
  const guard = (q) => { if (q.x < 2 || q.y < 2 || q.x > 1278 || q.y > 758) throw new Error('point off the screen: ' + JSON.stringify(q)); };
  async function rect(mat, layer, x0, y0, x1, y1){
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); window.__pg.setPaintMode('rect'); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1); guard(a); guard(c);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  // a brush drag with the tool in hand, from one world point to another
  async function drag(tool, layer, x0, y0, x1, y1){
    await p.evaluate(([t,l]) => { window.__pg.setLayer(l); window.__pg.setTool(t); window.__pg.deselect(); window.__pg.setPaintMode('brush'); }, [tool, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1); guard(a); guard(c);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:10}); await p.mouse.up();
    await p.waitForTimeout(200);
  }
  const stats = () => p.evaluate(() => window.__pg.stats());
  const water = () => p.evaluate(() => window.__pg.waterInfo());
  const total = () => p.evaluate(() => window.__pg.waterTotal());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(true); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const run = async (ms) => { await p.evaluate(() => window.__pg.paused(false)); await p.waitForTimeout(ms); };
  const areaOf = (st, mat) => st.filter(o => o.pieces.some(pc => pc.indexOf(mat) === 0)).reduce((a, o) => a + o.area, 0);

  console.log('');
  console.log('== the eraser only takes from the layer you are on ==');
  await fresh();
  await rect('rubber', 1, X-100, Y-60, X+100, Y+60);        // Mid
  await rect('metal', 0, X-100, Y-60, X+100, Y+60);         // Back, the same spot
  const a0 = await stats();
  const midA0 = areaOf(a0, 'rubber'), backA0 = areaOf(a0, 'metal');
  ok('a rubber Mid block and a metal Back block sit on top of each other', midA0 > 20000 && backA0 > 20000, { midA0, backA0 });
  await drag('erase', 0, X-60, Y, X+60, Y);                 // erase across the middle, on the BACK layer
  const a1 = await stats();
  ok('erasing on Back cuts the Back block', areaOf(a1, 'metal') < backA0 * 0.85, { before: backA0, after: areaOf(a1, 'metal') });
  ok('and leaves the Mid block alone', Math.abs(areaOf(a1, 'rubber') - midA0) < 1, { before: midA0, after: areaOf(a1, 'rubber') });
  await drag('erase', 1, X-60, Y, X+60, Y);                 // and on Mid
  const a2 = await stats();
  ok('erasing on Mid cuts the Mid block', areaOf(a2, 'rubber') < midA0 * 0.85, { before: midA0, after: areaOf(a2, 'rubber') });
  ok('and leaves what is left of the Back block alone', Math.abs(areaOf(a2, 'metal') - areaOf(a1, 'metal')) < 1);

  console.log('');
  console.log('== the vacuum takes water and nothing else ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+300, Y+140);        // a floor
  await rect('wood', 1, X-300, Y-100, X-260, Y+100);        // walls of a basin
  await rect('wood', 1, X+260, Y-100, X+300, Y+100);
  await lockAll();
  await rect('sponge', 1, X+100, Y+40, X+160, Y+100);       // a block in the basin
  await lockAll();
  await p.evaluate(([x,y]) => window.__pg.pour(x, y, 60, 1), [X-100, Y+40]);
  await run(1500);
  await p.evaluate(() => window.__pg.paused(true));
  const w0 = await water(), t0 = await total();
  ok('water poured into the basin has settled', w0.count > 20 && t0 > 15, { w0, t0 });
  const blockA0 = areaOf(await stats(), 'sponge'), floorA0 = areaOf(await stats(), 'wood');
  await drag('vacuum', 1, X-250, Y+80, X+250, Y+80);        // sweep the vacuum along the water line, across the block and the floor
  const w1 = await water(), t1 = await total();
  ok('the vacuum sucks the water up', t1 < t0 * 0.3, { before: t0, after: t1 });
  ok('and leaves the block and the floor exactly as they were', Math.abs(areaOf(await stats(), 'sponge') - blockA0) < 1 && Math.abs(areaOf(await stats(), 'wood') - floorA0) < 1, { block: [blockA0, areaOf(await stats(), 'sponge')], floor: [floorA0, areaOf(await stats(), 'wood')] });
  await drag('vacuum', 0, X-250, Y+96, X+250, Y+96);        // it works whatever layer you are on: a second sweep, lower, from Back
  ok('from the Back layer too', (await total()) < t1 * 0.8, { before: t1, after: await total() });

  console.log('');
  console.log('== the eraser mops water on Mid, not from Back ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+300, Y+140);
  await rect('wood', 1, X-300, Y-100, X-260, Y+100);
  await rect('wood', 1, X+260, Y-100, X+300, Y+100);
  await lockAll();
  await p.evaluate(([x,y]) => window.__pg.pour(x, y, 60, 1), [X, Y+40]);
  await run(1500);
  await p.evaluate(() => window.__pg.paused(true));
  const e0 = await total();
  await drag('erase', 0, X-200, Y+80, X+200, Y+80);         // erasing on Back: the water (Mid's) is untouched
  ok('erasing on the Back layer leaves the water be', Math.abs((await total()) - e0) < 0.01, { before: e0, after: await total() });
  await drag('erase', 1, X-200, Y+80, X+200, Y+80);
  ok('erasing on Mid mops it', (await total()) < e0 * 0.3, { before: e0, after: await total() });

  console.log('');
  console.log('== thin water dries up; a pool stays ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+300, Y+140);
  await rect('wood', 1, X-300, Y-100, X-260, Y+100);
  await rect('wood', 1, X+260, Y-100, X+300, Y+100);
  await lockAll();
  // a film: a little water spread thin along the floor
  await p.evaluate(([x,y]) => { for (let k = -8; k <= 8; k++) window.__pg.pour(x + k*16, y, 10, 0.12); }, [X, Y+92]);
  const f0 = await total();
  ok('a thin film is there to begin with', f0 > 1 && f0 < 16, f0);
  await run(3000);
  const f1 = await total();
  ok('and three seconds later it has dried up', f1 < 0.05, { before: f0, after: f1 });
  await p.evaluate(() => window.__pg.paused(true));
  // a real pool: the same basin, filled
  await p.evaluate(([x,y]) => window.__pg.pour(x, y, 70, 1), [X, Y+30]);
  await run(1200);
  const p0 = await total();
  await p.waitForTimeout(3000);
  const p1 = await total();
  ok('a proper pool keeps its water', p1 > p0 * 0.9, { before: p0, after: p1 });
  ok('with a surface, not specks: it sits in one run of columns', (await water()).count > 15);
  await p.evaluate(() => window.__pg.paused(true));

  console.log('');
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
