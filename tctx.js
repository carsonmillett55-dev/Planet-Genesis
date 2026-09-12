/* The object box: one docked panel for everything about what you have
   selected. It opens on a left- or right-click, follows the selection, and
   goes away when the selection does — by any route. node tctx.js */
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
  let X = cam.x + 320, Y = cam.y + 260;
  async function drag(pts, btn){
    const s0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), pts[0]);
    await p.mouse.move(s0.x, s0.y); await p.mouse.down({button: btn||'left'});
    for (const q of pts.slice(1)){ const s = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), q); await p.mouse.move(s.x, s.y, {steps:6}); }
    await p.mouse.up({button: btn||'left'}); await p.waitForTimeout(170);
  }
  const use = (k,br,mode) => p.evaluate(([k,br,mode]) => { window.__pg.setTool(k); if(br) window.__pg.setBrush(br); if(mode) window.__pg.setPaintMode(mode); window.__pg.deselect(); }, [k,br,mode]);
  const open = () => p.evaluate(() => window.__pg.ctxOpen());
  const title = () => p.evaluate(() => document.querySelector('#opHead .t').textContent);
  const rect = () => p.evaluate(() => { const r = document.getElementById('objPanel').getBoundingClientRect(); return { l:Math.round(r.left), t:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height) }; });
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

  console.log('');
  console.log('== the box goes when its object does ==');
  await makeAndOpen('light');
  ok('right-click opens it', await open());
  await p.keyboard.press('Delete');
  await p.waitForTimeout(300);
  ok('Delete closes it', !(await open()));

  await makeAndOpen('wood');
  await p.evaluate(() => window.__pg.deleteSel());
  await p.waitForTimeout(300);
  ok('the Delete button in the box closes it', !(await open()));

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

  console.log('');
  console.log('== the camera does not shake it off ==');
  /* The old popup was pinned to a spot on the level, so any camera move had
     to close it or it would be pointing at nothing. The box is docked to
     the screen, so it stays put and stays open. */
  await makeAndOpen('wood');
  await p.evaluate(() => window.__pg.zoomTo(1.9, 500, 1900));
  await p.waitForTimeout(300);
  ok('zooming leaves it open', await open());

  // A right-drag pans only from EMPTY space — on an object the right button
  // selects that object instead — so this works in screen coordinates, up in
  // the sky, and checks the camera really moved.
  await makeAndOpen('wood');
  const cam0 = await p.evaluate(() => window.__pg.cam());
  await p.mouse.move(900, 200); await p.mouse.down({button:'right'});
  await p.mouse.move(820, 170, {steps:6}); await p.mouse.move(760, 150, {steps:6});
  await p.mouse.up({button:'right'});
  await p.waitForTimeout(250);
  const cam1 = await p.evaluate(() => window.__pg.cam());
  ok('the right-drag panned', Math.abs(cam1.x - cam0.x) > 20, [cam0.x, cam1.x]);
  ok('panning leaves it open', await open());

  console.log('');
  console.log('== only the right button opens it ==');
  await makeAndOpen('wood');
  ok('and it says what the thing is', /Timber|Wood/i.test(await title()), await title());
  await p.evaluate(() => window.__pg.deselect());
  await p.waitForTimeout(150);
  ok('deselecting closes it', !(await open()));
  /* A left-click is for grabbing, moving and resizing. It selects, but the
     box stays out of the way. */
  const lc = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+100, Y+70]);
  await p.mouse.click(lc.x, lc.y);
  await p.waitForTimeout(250);
  ok('a left-click selects it', (await p.evaluate(() => window.__pg.selection())).length === 1);
  ok('but does not open the box', !(await open()));
  await p.mouse.click(lc.x, lc.y, { button:'right' });
  await p.waitForTimeout(250);
  ok('a right-click does', await open());
  await p.click('#opClose');
  await p.waitForTimeout(150);
  ok('the close button closes it', !(await open()));
  ok('and keeps the selection, so you can still drag it', (await p.evaluate(() => window.__pg.selection())).length === 1);

  console.log('');
  console.log('== the lock says what it is ==');
  await makeAndOpen('wood');
  const lockText = () => p.evaluate(() => Array.from(document.querySelectorAll('#opBody button')).map(b => b.textContent).find(t => /Locked|Unlocked/.test(t)));
  const l0 = await lockText();
  ok('the lock shows the current state', /Locked|Unlocked/.test(l0 || ''), l0);
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#opBody button')).find(x => /Locked|Unlocked/.test(x.textContent)); b.click(); });
  await p.waitForTimeout(200);
  const l1 = await lockText();
  ok('and flips when you click it', !!l1 && l1 !== l0, { l0, l1 });

  console.log('');
  console.log('== it survives being used ==');
  await makeAndOpen('light');
  await p.evaluate(() => {
    var sl = Array.from(document.querySelectorAll('#objPanel input[type=range]')).find(function(i){ return /Glow/.test(i.parentNode.textContent) || /Glow/.test(i.parentNode.parentNode.textContent); });   // the Glow slider, not Opacity above it
    sl.value = 4; sl.dispatchEvent(new Event('input', {bubbles:true}));
  });
  await p.waitForTimeout(200);
  const glow = await p.evaluate(() => window.__pg.objects().filter(function(o){ return o.allGlow; })[0].glow);
  ok('dragging the glow slider works', Math.abs(glow - 4) < 0.001, glow);
  ok('and leaves the box open', await open());

  console.log('');
  console.log('== it is yours to move ==');
  await makeAndOpen('wood');
  const r0 = await rect();
  const head = await p.evaluate(() => { const r = document.getElementById('opHead').getBoundingClientRect(); return { x:r.left + 60, y:r.top + r.height/2 }; });
  await p.mouse.move(head.x, head.y); await p.mouse.down();
  await p.mouse.move(head.x - 150, head.y + 60, { steps: 6 });
  await p.mouse.move(head.x - 300, head.y + 120, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(250);
  const r1 = await rect();
  ok('dragging the header moves it', r1.l < r0.l - 200 && r1.t > r0.t + 80, { r0, r1 });
  await p.reload();
  await p.waitForTimeout(1200);
  await p.evaluate(() => { window.__pg.freezeCam(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); });
  /* The zoom is remembered across a reload, and an earlier check zoomed in,
     so the old X/Y would now be off-screen. Re-read the camera. */
  const camR = await p.evaluate(() => window.__pg.cam());
  X = camR.x + 320; Y = camR.y + 260;
  await makeAndOpen('wood');
  const r2 = await rect();
  ok('and it remembers where you put it', Math.abs(r2.l - r1.l) < 4 && Math.abs(r2.t - r1.t) < 4, { r1, r2 });
  await p.evaluate(() => localStorage.removeItem('pg_panel'));

  console.log('');
  console.log((fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join(String.fromCharCode(10)) : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
