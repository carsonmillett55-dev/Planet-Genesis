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
  const X = cam.x + 320, Y = cam.y + 260;
  async function drag(pts, btn){
    const s0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), pts[0]);
    await p.mouse.move(s0.x, s0.y); await p.mouse.down({button: btn||'left'});
    for (const q of pts.slice(1)){ const s = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), q); await p.mouse.move(s.x, s.y, {steps:6}); }
    await p.mouse.up({button: btn||'left'}); await p.waitForTimeout(170);
  }
  const use = (k,br,mode) => p.evaluate(([k,br,mode]) => { window.__pg.setTool(k); if(br) window.__pg.setBrush(br); if(mode) window.__pg.setPaintMode(mode); window.__pg.deselect(); }, [k,br,mode]);
  const open = () => p.evaluate(() => window.__pg.ctxOpen());
  async function makeAndOpen(mat){
    await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
    await p.waitForTimeout(150);
    await use(mat, 1.2, 'rect');
    await drag([[X, Y],[X+200, Y+140]]);
    await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
    const s = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+100, Y+70]);
    await p.mouse.click(s.x, s.y, { button:'right' });
    await p.waitForTimeout(220);
    return s;
  }

  console.log('\n== the menu goes when its object does ==');
  await makeAndOpen('light');
  ok('right-click opens it', await open());
  await p.keyboard.press('Delete');
  await p.waitForTimeout(300);
  ok('Delete closes it', !(await open()));

  await makeAndOpen('wood');
  await p.evaluate(() => window.__pg.deleteSel());
  await p.waitForTimeout(300);
  ok('the bin on the selection bar closes it', !(await open()));

  await makeAndOpen('metal');
  await use('erase', 3, 'brush');
  await drag([[X-60, Y+70],[X+280, Y+70]]);
  await drag([[X-60, Y+20],[X+280, Y+20]]);
  await drag([[X-60, Y+120],[X+280, Y+120]]);
  await p.waitForTimeout(300);
  ok('erasing it away closes it', !(await open()), await p.evaluate(()=>window.__pg.stats().length));

  await makeAndOpen('sponge');
  await use('sponge', 3, 'brush');
  await drag([[X-60, Y+70],[X+280, Y+70]], 'right');
  await drag([[X-60, Y+20],[X+280, Y+20]], 'right');
  await drag([[X-60, Y+120],[X+280, Y+120]], 'right');
  await p.waitForTimeout(300);
  ok('cutting it away closes it', !(await open()));

  await makeAndOpen('wood');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); });
  await p.waitForTimeout(300);
  ok('clearing the level closes it', !(await open()));

  await makeAndOpen('ice');
  await p.evaluate(() => window.__pg.undo());
  await p.waitForTimeout(350);
  ok('undoing the object away closes it', !(await open()));

  await makeAndOpen('rubber');
  const d = await p.evaluate(() => window.__pg.serialize('x'));
  await p.evaluate(dd => window.__pg.load(dd), d);
  await p.waitForTimeout(350);
  ok('loading a level closes it', !(await open()));

  console.log('\n== and it does not strand itself on screen ==');
  await makeAndOpen('wood');
  await p.evaluate(() => window.__pg.zoomTo(1.9, 500, 1900));
  await p.waitForTimeout(300);
  ok('zooming closes it', !(await open()));

  // A right-drag pans only from EMPTY space — on an object the right button
  // opens that object's menu instead — so this one works in screen
  // coordinates, up in the sky, and checks the camera really moved.
  await makeAndOpen('wood');
  const cam0 = await p.evaluate(() => window.__pg.cam());
  await p.mouse.move(900, 200); await p.mouse.down({button:'right'});
  await p.mouse.move(820, 170, {steps:6}); await p.mouse.move(760, 150, {steps:6});
  await p.mouse.up({button:'right'});
  await p.waitForTimeout(250);
  const cam1 = await p.evaluate(() => window.__pg.cam());
  ok('the right-drag panned', Math.abs(cam1.x - cam0.x) > 20, [cam0.x, cam1.x]);
  ok('panning closes it', !(await open()));

  console.log('\n== but it survives being used ==');
  await makeAndOpen('light');
  await p.evaluate(() => {
    var sl = document.querySelector('#objCtxMenu input[type=range]');
    sl.value = 4; sl.dispatchEvent(new Event('input', {bubbles:true}));
  });
  await p.waitForTimeout(200);
  const glow = await p.evaluate(() => window.__pg.objects().filter(function(o){ return o.allGlow; })[0].glow);
  ok('dragging the glow slider works', Math.abs(glow - 4) < 0.001, glow);
  ok('and leaves the menu open', await open());

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join('\n') : 'none');
  await b.close();
})();
