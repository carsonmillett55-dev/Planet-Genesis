/* Planet Genesis regression suite.
   node regress.js            — functional checks
   node regress.js perf       — plus migration + frame-time on a real level
   Needs preview.html (python3 mkprev.py) and matter.min.js alongside. */
const { launch, previewURL } = require('./tenv');
const fs = require('fs');
let pass=0, fail=0;
const ok=(n,c,e)=>{ if(c){pass++;console.log('  ok  '+n);} else {fail++;console.log('  FAIL '+n+(e!==undefined?'  -> '+JSON.stringify(e):''));} };
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport:{width:1280,height:760} });
  const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
  p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await p.goto(previewURL);
  await p.waitForTimeout(1100);
  await p.evaluate(() => { window.__pg.freezeCam(); window.__pg.setStick(true); window.__pg.setPaintMode('brush'); });
  const cam = await p.evaluate(() => window.__pg.cam());
  const X = cam.x + 330, Y = cam.y + 250;
  async function drag(pts, btn){
    const s0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), pts[0]);
    await p.mouse.move(s0.x, s0.y); await p.mouse.down({button: btn||'left'});
    for (const q of pts.slice(1)){ const s = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), q); await p.mouse.move(s.x, s.y, {steps:6}); }
    await p.mouse.up({button: btn||'left'}); await p.waitForTimeout(160);
  }
  const stats = () => p.evaluate(() => window.__pg.stats());
  const tool = (t,br,sh) => p.evaluate(([t,br,sh]) => { window.__pg.setTool(t); if(br) window.__pg.setBrush(br); if(sh) window.__pg.setBrushShape(sh); }, [t,br,sh]);
  const reset = async () => { await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setPaintMode('brush'); window.__pg.deselect(); }); await p.waitForTimeout(150); };
  const mine = async () => (await stats()).filter(o => o.pos.y < 2300);

  console.log('\n== painting ==');
  await reset(); await tool('wood', 2.4, 'circle');
  await drag([[X, Y],[X+420, Y]]);
  let m = await mine();
  ok('a straight drag is one clean contour', m.length===1 && m[0].pieces[0].indexOf('wood')===0 && m[0].corners < 40, m);
  ok('and exactly brush-tall', Math.abs(m[0].area - (420*72 + Math.PI*36*36)) < 400, m[0].area);

  console.log('\n== cross-material CSG and the cut ==');
  await tool('darkmatter', 0.5, 'circle');
  await drag([[X+200, Y-80],[X+200, Y+80]]);
  m = await mine();
  ok('welded into one object, two materials', m.length===1 && m[0].pieces.length===2, m);
  ok('the wood is now two islands', m[0].pieces[0].indexOf('wood:')===0 && m[0].rings[0].length===2, m[0].rings);
  const dmPt = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+200, Y]);
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  await p.mouse.click(dmPt.x, dmPt.y, { button:'right' });
  await p.waitForTimeout(200);
  ok('right-click with Move picks the dark matter region',
     (await p.evaluate(()=>{const r=window.__pg.selectedRegion();return r&&r.materialId;})) === 'darkmatter');
  const n0 = (await mine()).length;
  await p.evaluate(() => { const r = window.__pg.selectedRegion(); if (r) window.__pg.deleteRegion(r); });
  await p.waitForTimeout(250);
  ok('deleting it leaves two separate objects', (await mine()).length === n0 + 1, (await mine()).length);

  console.log('\n== holes ==');
  await reset(); await p.evaluate(()=>window.__pg.setPaintMode('rect'));
  await tool('wood', 1); await drag([[X, Y],[X+300, Y+220]]);
  await tool('sponge', 1); await drag([[X+110, Y+80],[X+190, Y+140]]);
  m = await mine();
  ok('a material painted inside another leaves a hole in it', m[0].rings[0][0] === 2, m[0].rings);
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  const spPt = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+150, Y+110]);
  await p.mouse.click(spPt.x, spPt.y, { button:'right' });
  await p.waitForTimeout(200);
  await p.evaluate(() => { const r = window.__pg.selectedRegion(); if (r) window.__pg.deleteRegion(r); });
  await p.waitForTimeout(250);
  m = await mine();
  ok('deleting it leaves the hole behind', m[0].rings[0][0] === 2, m[0].rings);
  ok('the hole is empty', await p.evaluate(([x,y]) => !window.__pg.objectAt(x,y,0), [X+150, Y+110]));

  console.log('\n== right-click cuts ==');
  await reset(); await p.evaluate(()=>window.__pg.setPaintMode('rect'));
  await tool('metal', 1); await drag([[X, Y],[X+320, Y+200]]);
  const a0 = (await mine())[0].area;
  await p.evaluate(() => { window.__pg.setPaintMode('brush'); window.__pg.deselect(); });
  await tool('metal', 1.6, 'square');
  const cPt = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+160, Y+100]);
  await p.mouse.click(cPt.x, cPt.y, { button:'right' });
  await p.waitForTimeout(300);
  m = await mine();
  ok('a right-click punches the brush shape out', m[0].rings[0][0] === 2, m[0].rings);
  ok('exactly the brush shape', Math.abs((a0 - m[0].area) - 48*48) < 30, {removed: a0 - m[0].area});
  const a1 = m[0].area;
  await drag([[X+320, Y+40],[X+320, Y+170]], 'right');
  ok('a right-drag shaves the edge', (await mine())[0].area < a1, {before:a1, after:(await mine())[0].area});
  await p.evaluate(() => { window.__pg.setPaintMode('ellipse'); window.__pg.deselect(); });
  await drag([[X+40, Y+30],[X+140, Y+120]], 'right');
  m = await mine();
  ok('a right-drag in a shape mode cuts that shape', m[0].rings[0][0] >= 2, m[0].rings);

  console.log('\n== cuts stay on the layer you are on ==');
  await reset(); await p.evaluate(()=>{ window.__pg.setPaintMode('rect'); window.__pg.setLayer(0); });
  await tool('sponge', 1); await drag([[X, Y],[X+300, Y+200]]);
  await p.evaluate(()=>window.__pg.setLayer(1));
  await tool('wood', 1); await drag([[X+40, Y+40],[X+260, Y+160]]);
  const before = (await mine()).map(o=>o.area);
  await p.evaluate(() => { window.__pg.setPaintMode('brush'); window.__pg.deselect(); });
  await tool('wood', 1.6, 'circle');
  const lPt = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+150, Y+100]);
  await p.mouse.click(lPt.x, lPt.y, { button:'right' });
  await p.waitForTimeout(300);
  const after = await mine();
  ok('the layer you are on is cut', after.find(o=>o.layer===1).area < before[1]);
  ok('the layer behind is untouched', after.find(o=>o.layer===0).area === before[0]);
  await p.evaluate(()=>window.__pg.setLayer(1));

  console.log('\n== erase, undo, save/load ==');
  await reset(); await tool('wood', 2, 'circle');
  await drag([[X, Y],[X+400, Y]]);
  await tool('erase', 1); await drag([[X+150, Y-70],[X+150, Y+70]]);
  ok('the eraser cuts a shape in two', (await mine()).length === 2, (await mine()).length);
  await p.evaluate(()=>window.__pg.undo()); await p.waitForTimeout(300);
  ok('undo puts it back whole', (await mine()).length === 1);
  await p.evaluate(()=>window.__pg.redo()); await p.waitForTimeout(300);
  ok('redo re-cuts it', (await mine()).length === 2);
  const snap = await mine();
  const data = await p.evaluate(() => window.__pg.serialize('rt'));
  ok('saves as the current level format', data.version === 4, data.version);
  await p.evaluate(d => window.__pg.load(d), data); await p.waitForTimeout(300);
  const back = await mine();
  ok('save/load round trip is identical',
     JSON.stringify(snap.map(o=>[o.corners,o.pos])) === JSON.stringify(back.map(o=>[o.corners,o.pos])),
     {snap:snap.map(o=>o.corners), back:back.map(o=>o.corners)});

  console.log('\n== play mode ==');
  await reset(); await tool('hazard', 1.2, 'circle');
  await drag([[X, Y+260],[X+300, Y+260]]);
  const beforePlay = (await stats()).length;
  await p.evaluate(()=>window.__pg.setMode('play')); await p.waitForTimeout(1500);
  ok('play mode runs', (await p.evaluate(()=>window.__pg.mode())) === 'play');
  await p.evaluate(()=>window.__pg.setMode('build')); await p.waitForTimeout(600);
  ok('build mode restores the level', (await stats()).length === beforePlay, (await stats()).length);

  console.log('\n== a thrown frame does not kill the loop ==');
  await reset();
  /* Break something only the renderer reads. drawObject calls objectPaths,
     which walks obj.pieces, while the physics step works off body and parts
     — so this throws on the draw path without also breaking the Matter
     beforeUpdate handler, which would muddy what the check is proving.
     The throw lands inside drawFrame's own save(), so the canvas unwind is
     exercised too, not just the reschedule. */
  const brokeIt = await p.evaluate(() => {
    const os = window.__pg.objects();
    if (!os.length) return false;
    window.__pgHeld = os[0].pieces;
    window.__pgRev = os[0].geomRev || 0;
    os[0].pieces = null;
    /* objectPaths caches on geomRev, so corrupting pieces alone changes
       nothing — the cached paths are handed back and the frame draws fine.
       Bumping the revision forces the miss that reaches the bad data. */
    os[0].geomRev = (os[0].geomRev || 0) + 1;
    return true;
  });
  ok('there was something to break', brokeIt);
  await p.waitForTimeout(300);
  await p.evaluate(() => { const os = window.__pg.objects(); if (window.__pgHeld && os[0]){ os[0].pieces = window.__pgHeld; os[0].geomRev = window.__pgRev; } });
  await p.waitForTimeout(300);
  /* If the loop had died on that frame the canvas would be frozen on its
     last good one, so a world-light change could never reach the screen.
     brightest() scans the whole canvas, so it does not depend on picking a
     lucky pixel. */
  const lum = () => p.evaluate(() => window.__pg.brightest().lum);
  const lumBefore = await lum();
  await p.evaluate(() => window.__pg.worldLight(0.05));
  /* Poll instead of sleeping. A fixed wait is a coin flip on a loaded
     machine — this check failed roughly one run in nine that way, which is
     worse than not having it. */
  let lumAfter = lumBefore;
  for (let i = 0; i < 30 && lumAfter === lumBefore; i++){ await p.waitForTimeout(100); lumAfter = await lum(); }
  ok('the loop survived and the canvas still updates', lumBefore !== lumAfter, { lumBefore, lumAfter });
  await p.evaluate(() => window.__pg.worldLight(1));
  await p.waitForTimeout(300);
  /* Those console errors were this test's doing. The run fails on any
     unexpected console error, so drop the ones we asked for. */
  for (let i = errs.length - 1; i >= 0; i--){
    if (/frame failed to draw|further frame errors/.test(errs[i])) errs.splice(i, 1);
  }

  console.log('\n== saving twice updates one level, not two ==');
  await p.evaluate(() => { localStorage.removeItem('pg_local_levels'); localStorage.removeItem('pg_level_id'); });
  await reset();
  const ctrlS = async () => { await p.keyboard.down('Control'); await p.keyboard.press('KeyS'); await p.keyboard.up('Control'); };
  const stored = () => p.evaluate(() => JSON.parse(localStorage.getItem('pg_local_levels') || '[]'));
  const storedCount = async () => (await stored()).length;
  /* Wait for the write to actually land rather than guessing at a delay.
     Saving is a promise chain, so the store is not updated by the time the
     keystroke returns. */
  const settleTo = async (want) => { for (let i = 0; i < 30; i++){ if (await storedCount() === want) return want; await p.waitForTimeout(100); } return storedCount(); };
  const newestStamp = async () => { const l = await stored(); return l.length ? ((l[0].data && l[0].data.updatedAt) || 0) : 0; };

  await ctrlS();
  ok('the first save stores the level', (await settleTo(1)) === 1, await storedCount());
  /* For the second save, waiting on the count proves nothing — it is already
     1 and would pass instantly whether or not the save happened. Wait for
     the stored timestamp to move, which means the write landed, THEN count. */
  const stamp1 = await newestStamp();
  await ctrlS();
  for (let i = 0; i < 30; i++){ if (await newestStamp() !== stamp1) break; await p.waitForTimeout(100); }
  const afterTwo = await storedCount();
  ok('the second save updates it instead of adding a copy', afterTwo === 1, afterTwo);
  ok('and the session remembers which level it is editing',
     await p.evaluate(() => { const j = JSON.parse(localStorage.getItem('pg_level_id') || 'null'); return !!(j && j.local); }));
  /* A brand new level must drop that identity, or its first save would
     overwrite whatever was open before it. */
  await p.keyboard.down('Control'); await p.keyboard.press('KeyN'); await p.keyboard.up('Control');
  await p.waitForTimeout(200);
  await p.click('#confirmYes');
  await p.waitForTimeout(400);
  ok('starting a new level forgets the old one',
     await p.evaluate(() => { const j = JSON.parse(localStorage.getItem('pg_level_id') || 'null'); return !j || (!j.local && !j.cloud); }),
     await p.evaluate(() => localStorage.getItem('pg_level_id')));
  await ctrlS();
  ok('and saving it stores a second level rather than overwriting the first', (await settleTo(2)) === 2, await storedCount());

  if (process.argv[2] === 'perf'){
    console.log('\n== migration + frame time on the real level ==');
    const lv = JSON.parse(JSON.parse(fs.readFileSync(__dirname+'/level.json','utf8')).payload);
    const t = await p.evaluate((l)=>{ const t0=performance.now(); window.__pg.load(l); return Math.round(performance.now()-t0); }, lv);
    await p.waitForTimeout(700);
    const st = await stats();
    console.log('   migrated in ' + t + 'ms: ' + st.reduce((s,o)=>s+o.corners,0) + ' corners, ' +
                st.reduce((s,o)=>s+o.parts,0) + ' physics parts, ' +
                ((await p.evaluate(()=>JSON.stringify(window.__pg.serialize('x')).length))/1024).toFixed(1) + 'KB');
    for (const z of [0.3, 0.82, 1.6, 2.6]){
      await p.evaluate(zz => window.__pg.zoomTo(zz, 900, 1850), z);
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => new Promise(res => {
        const ts=[]; let last=performance.now(), n=0;
        (function tick(){ const now=performance.now(); ts.push(now-last); last=now;
          if (++n<80) requestAnimationFrame(tick);
          else { ts.sort((a,b)=>a-b); res({med:+ts[40].toFixed(1), p90:+ts[72].toFixed(1)}); } })();
      }));
      console.log('   zoom ' + Math.round(z*100) + '%: median ' + r.med + 'ms, p90 ' + r.p90 + 'ms');
      ok('60fps at ' + Math.round(z*100) + '% zoom', r.med < 18, r);
    }
  }

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,8).join('\n') : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
