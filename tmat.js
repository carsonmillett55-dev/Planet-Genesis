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
  await p.evaluate(() => { window.__pg.freezeCam(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); });
  const cam = await p.evaluate(() => window.__pg.cam());
  const X = cam.x + 280, Y = cam.y + 220;
  async function drag(pts){
    const s0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), pts[0]);
    await p.mouse.move(s0.x, s0.y); await p.mouse.down();
    for (const q of pts.slice(1)){ const s = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), q); await p.mouse.move(s.x, s.y, {steps:6}); }
    await p.mouse.up(); await p.waitForTimeout(170);
  }
  const stats = () => p.evaluate(() => window.__pg.stats());
  const mine = async () => (await stats()).filter(o => o.pos.y < 2300);
  const tool = (t,br) => p.evaluate(([t,br]) => { window.__pg.setTool(t); if(br) window.__pg.setBrush(br); window.__pg.deselect(); }, [t,br]);

  console.log('\n== colour keys resolve ==');
  const res = await p.evaluate(() => {
    const a = window.__pg.matOf('wood'), c = window.__pg.matOf('wood:9'), bad = window.__pg.matOf('nope');
    return { natural:a.color, tinted:c.color, tintedEdge:c.dark, sameFriction: a.friction === c.friction,
             label:c.label, junk: bad };
  });
  console.log('   ', JSON.stringify(res));
  ok('a tint changes the colour', res.natural !== res.tinted, res);
  ok('and derives its own edge colour', /^#[0-9a-f]{6}$/i.test(res.tintedEdge), res.tintedEdge);
  ok('but keeps the material physics', res.sameFriction);
  ok('an unknown key resolves to nothing', res.junk === null);

  console.log('\n== same material, different colour = different material ==');
  await tool('wood', 1);
  await drag([[X, Y],[X+300, Y+180]]);
  await p.evaluate(() => { window.__pg.setTool(window.__pg.matKey('wood', 16)); window.__pg.deselect(); });
  await p.evaluate(() => window.__pg.setPaintMode('brush'));
  await p.evaluate(() => window.__pg.setBrush(1.4));
  await drag([[X+80, Y+90],[X+220, Y+90]]);
  let m = await mine();
  console.log('   ', JSON.stringify(m.map(o=>o.pieces)));
  ok('the two colours are separate regions', m[0].pieces.length === 2, m[0].pieces);
  ok('and the new colour cut a socket in the old', m[0].rings[0][0] === 2, m[0].rings);

  console.log('\n== glass ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('glass', 1);
  await drag([[X, Y],[X+280, Y+180]]);
  m = await mine();
  ok('glass is a solid you can stand on', m[0].parts >= 1 && !m[0].pieces[0].indexOf('glass'), m[0]);

  console.log('\n== light ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('light', 1);
  await drag([[X, Y],[X+160, Y+120]]);
  m = await mine();
  const lit = await p.evaluate(() => { const o = window.__pg.objects().filter(q=>q.allGlow)[0];
    return o ? { allGlow:o.allGlow, sensor:o.body.isSensor, still:o.body.isStatic, glow:o.glow, parts:o.parts.length } : null; });
  console.log('   ', JSON.stringify(lit));
  ok('a light-only shape holds itself up', lit && lit.still, lit);
  ok('and you walk straight through it', lit && lit.sensor, lit);
  ok('it still has a body to select', lit && lit.parts === 1, lit);

  console.log('\n== light painted into something solid ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setStick(false); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('wood', 1);
  await drag([[X, Y],[X+300, Y+180]]);
  await p.evaluate(() => { window.__pg.setTool('light'); window.__pg.setPaintMode('brush'); window.__pg.setBrush(1.2); window.__pg.deselect(); });
  /* The plank is dynamic on purpose — the check below asserts it still
     falls — so by now it has dropped a couple of hundred pixels from
     where it was painted. Aim the light at where it actually IS, not at
     the paint coordinates, or the stroke lands in empty space and welds
     into nothing. */
  const plankPos = await p.evaluate(() => {
    const o = window.__pg.objects().filter(q => !q.body.isStatic)[0];
    return o ? { x:o.body.position.x, y:o.body.position.y } : null;
  });
  if (!plankPos) throw new Error('no dynamic plank to paint into');
  await drag([[plankPos.x-15, plankPos.y],[plankPos.x+15, plankPos.y]]);
  const mixed = await p.evaluate(() => { const o = window.__pg.objects().filter(q=>q.pieces.length>1)[0];
    return o ? { pieces:o.pieces.map(x=>x.m), sensor:o.body.isSensor, still:o.body.isStatic, allGlow:o.allGlow } : null; });
  console.log('   ', JSON.stringify(mixed));
  ok('a plank with a light in it is still a plank', mixed && !mixed.sensor && !mixed.allGlow, mixed);
  ok('and still falls', mixed && !mixed.still, mixed);

  console.log('\n== world light and the glow pass ==');
  await p.evaluate(() => window.__pg.worldLight(0.15));
  await p.waitForTimeout(500);
  ok('world light is set', Math.abs(await p.evaluate(()=>window.__pg.worldLight()) - 0.15) < 0.001);
  const fr = await p.evaluate(() => new Promise(res => {
    const ts=[]; let last=performance.now(), n=0;
    (function tick(){ const now=performance.now(); ts.push(now-last); last=now;
      if (++n<70) requestAnimationFrame(tick); else { ts.sort((a,b)=>a-b); res(+ts[35].toFixed(1)); } })();
  }));
  console.log('   median frame with lighting on:', fr + 'ms');
  ok('lighting keeps 60fps', fr < 18, fr);
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  await p.mouse.move(1180, 700);
  await p.waitForTimeout(400);
  await p.screenshot({ path:'night.png' });

  console.log('\n== colours survive save and load ==');
  await p.evaluate(() => window.__pg.worldLight(0.4));
  const data = await p.evaluate(() => window.__pg.serialize('mat'));
  const before = await mine();
  await p.evaluate(d => window.__pg.load(d), data);
  await p.waitForTimeout(350);
  const after = await mine();
  /* Compare the materials, which is what this check is about, not the exact
     corner counts. The plank is dynamic and is still turning as it falls, so
     a rebuild between the serialize and the reading can bake in a fraction of
     a degree of rotation and clean one near-collinear corner away. That is
     the geometry behaving correctly; asserting on it made this fail about one
     run in three. Corner counts are still checked, with room for exactly that
     to happen. */
  const matsOf = (list) => list.map(o => o.pieces.map(s => s.slice(0, s.lastIndexOf(':'))));
  const vertsOf = (list) => list.map(o => o.pieces.map(s => parseInt(s.slice(s.lastIndexOf(':')+1), 10)));
  ok('same materials come back', JSON.stringify(matsOf(before)) === JSON.stringify(matsOf(after)),
     {before:matsOf(before), after:matsOf(after)});
  const vb = JSON.stringify(vertsOf(before)), va = vertsOf(after);
  ok('and the same shapes, give or take a cleaned corner',
     vertsOf(before).length === va.length &&
     vertsOf(before).every((o,i) => o.length === va[i].length && o.every((n,j) => Math.abs(n - va[i][j]) <= 2)),
     {before:vb, after:JSON.stringify(va)});
  ok('world light comes back', Math.abs(await p.evaluate(()=>window.__pg.worldLight()) - 0.4) < 0.001);

  console.log('');
  console.log('== opacity: on new paint, and on an object after ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await p.evaluate(() => window.__pg.setPaintAlpha(0.4));
  await tool('wood');
  await drag([[X, Y],[X+120, Y+60]]);
  const ghostly = (await stats()).filter(o => o.pos.y < 2300)[0];
  ok('paint drawn at 40% opacity makes an object at 40%', ghostly && Math.abs(ghostly.alpha - 0.4) < 0.001, ghostly && ghostly.alpha);
  await p.evaluate(() => window.__pg.setPaintAlpha(1));
  await tool('sponge');
  await drag([[X+200, Y],[X+320, Y+60]]);
  const solid = (await stats()).filter(o => o.pos.y < 2300 && o.pieces[0].indexOf('sponge') === 0)[0];
  ok('paint at 100% makes a solid one', solid && solid.alpha === 1, solid && solid.alpha);
  await p.evaluate(id => window.__pg.objAlpha(id, 0.25), solid.id);
  ok('an object can be made see-through after the fact', (await p.evaluate(id => window.__pg.objAlpha(id), solid.id)) === 0.25);
  const saved = await p.evaluate(() => window.__pg.serialize('op'));
  ok('the level file carries it, and not for a solid object', saved.objects.some(o => o.alpha === 0.25) && saved.objects.some(o => Math.abs(o.alpha - 0.4) < 0.001) && saved.objects.filter(o => o.alpha != null).length === 2, saved.objects.map(o => o.alpha));
  await p.evaluate(d => window.__pg.load(d), saved); await p.waitForTimeout(200);
  ok('and it comes back', (await stats()).filter(o => o.alpha < 1).length === 2, (await stats()).map(o => o.alpha));

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join('\n') : 'none');
  await b.close();
})();
