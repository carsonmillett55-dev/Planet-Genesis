const { chromium } = require('playwright');
let pass=0, fail=0;
const ok=(n,c,e)=>{ if(c){pass++;console.log('  ok  '+n);} else {fail++;console.log('  FAIL '+n+(e!==undefined?'  -> '+JSON.stringify(e):''));} };
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
  const p = await b.newPage({ viewport:{width:1280,height:760} });
  const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
  p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await p.goto('file://' + __dirname + '/preview.html');
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
  await drag([[X+140, Y+90],[X+170, Y+90]]);
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
  ok('same materials come back', JSON.stringify(before.map(o=>o.pieces)) === JSON.stringify(after.map(o=>o.pieces)),
     {before:before.map(o=>o.pieces), after:after.map(o=>o.pieces)});
  ok('world light comes back', Math.abs(await p.evaluate(()=>window.__pg.worldLight()) - 0.4) < 0.001);

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join('\n') : 'none');
  await b.close();
})();
