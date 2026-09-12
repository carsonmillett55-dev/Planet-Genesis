/* The fill: click inside a closed outline and the inside fills with the
   material — or with water. Open space, material itself and an outline with
   a gap in it fill nothing; an island inside the outline is left alone.
   node tfill.js */
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
  await p.evaluate(() => { window.__pg.freezeCam(); window.__pg.setStick(true); window.__pg.paused(true); window.__pg.setPaintMode('rect'); });
  const cam = await p.evaluate(() => window.__pg.cam());
  const X = cam.x + 400, Y = cam.y + 300;
  const w2p = (x,y) => p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [x,y]);
  async function rect(mat, layer, x0, y0, x1, y1){
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); window.__pg.setPaintMode('rect'); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  async function fillClick(mat, layer, x, y){
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); window.__pg.setPaintMode('fill'); }, [mat, layer]);
    const a = await w2p(x, y);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(200);
  }
  const stats = () => p.evaluate(() => window.__pg.stats());
  const areaOf = async (m) => (await stats()).reduce((s, o) => s + (o.pieces.some(pc => pc.indexOf(m + ':') === 0) ? o.areaBy[m] || 0 : 0), 0);
  const fresh = async () => { await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.deselect(); }); await p.waitForTimeout(150); };

  console.log('== a closed outline fills; open space, material and a gap do not ==');
  await fresh();
  // a hollow wooden box: four walls 20 thick, 300 x 200 outside
  await rect('wood', 1, X, Y, X+300, Y+20);
  await rect('wood', 1, X, Y+180, X+300, Y+200);
  await rect('wood', 1, X, Y, X+20, Y+200);
  await rect('wood', 1, X+280, Y, X+300, Y+200);
  const enc = await p.evaluate(([x,y]) => window.__pg.enclosedArea(x,y), [X+150, Y+100]);
  ok('the inside of the box reads as one enclosed space of 260 by 160', Math.abs(enc - 260*160) < 300, enc);
  ok('outside it, nothing is enclosed', (await p.evaluate(([x,y]) => window.__pg.enclosedArea(x,y), [X+400, Y+100])) === 0);
  ok('and a point on the wood is not a space to fill', (await p.evaluate(([x,y]) => window.__pg.enclosedArea(x,y), [X+10, Y+100])) === 0);
  const nBefore = (await stats()).length;
  await fillClick('sponge', 1, X+150, Y+100);
  const sp = await areaOf('sponge');
  ok('a click inside with sponge fills the inside with sponge', Math.abs(sp - 260*160) < 400, sp);
  ok('fused into the box it touches, not a loose block', (await stats()).length === nBefore, (await stats()).length);
  await fillClick('sponge', 1, X+400, Y+100);
  ok('a click in open space fills nothing', Math.abs((await areaOf('sponge')) - sp) < 1);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  ok('and the fill is one undo step', (await areaOf('sponge')) === 0, await areaOf('sponge'));

  console.log('');
  console.log('== a gap in the outline, and an island inside it ==');
  await fresh();
  await rect('wood', 1, X, Y, X+300, Y+20);
  await rect('wood', 1, X, Y+180, X+300, Y+200);
  await rect('wood', 1, X, Y, X+20, Y+200);
  await rect('wood', 1, X+280, Y, X+300, Y+120);            // the right wall stops short: a gap
  ok('an outline with a gap in it encloses nothing', (await p.evaluate(([x,y]) => window.__pg.enclosedArea(x,y), [X+150, Y+100])) === 0);
  await rect('wood', 1, X+280, Y+120, X+300, Y+200);         // closed now
  await rect('metal', 1, X+120, Y+80, X+180, Y+120);         // an island in the middle
  const enc2 = await p.evaluate(([x,y]) => window.__pg.enclosedArea(x,y), [X+60, Y+100]);
  ok('closed again, the space is the inside less the island', Math.abs(enc2 - (260*160 - 60*40)) < 400, enc2);
  await fillClick('rubber', 1, X+60, Y+100);
  const rb = await areaOf('rubber'), mt = await areaOf('metal');
  ok('filling round the island leaves the island', Math.abs(rb - (260*160 - 60*40)) < 500 && Math.abs(mt - 60*40) < 100, { rubber: rb, metal: mt });

  console.log('');
  console.log('== water fills a basin ==');
  await fresh();
  await rect('wood', 1, X, Y, X+300, Y+20);
  await rect('wood', 1, X, Y+180, X+300, Y+200);
  await rect('wood', 1, X, Y, X+20, Y+200);
  await rect('wood', 1, X+280, Y, X+300, Y+200);
  const w0 = await p.evaluate(() => window.__pg.waterTotal());
  await fillClick('water', 1, X+150, Y+100);
  const w1 = await p.evaluate(() => window.__pg.waterTotal());
  ok('a click inside with water fills the inside with water', w1 - w0 > 200, { before: w0, after: w1 });
  await fillClick('water', 1, X+400, Y+100);
  ok('and none lands in open space', Math.abs((await p.evaluate(() => window.__pg.waterTotal())) - w1) < 1);
  await fresh();
  await rect('wood', 0, X, Y, X+300, Y+20);
  await rect('wood', 0, X, Y+180, X+300, Y+200);
  await rect('wood', 0, X, Y, X+20, Y+200);
  await rect('wood', 0, X+280, Y, X+300, Y+200);
  ok('a Back-layer outline is enclosed on the Back layer', (await p.evaluate(([x,y,l]) => window.__pg.enclosedAreaOn(x,y,l), [X+150, Y+100, 0])) > 40000);
  ok('and not on the Mid layer', (await p.evaluate(([x,y,l]) => window.__pg.enclosedAreaOn(x,y,l), [X+150, Y+100, 1])) === 0);

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
