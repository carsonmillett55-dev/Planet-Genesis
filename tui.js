/* The editor's conveniences: Play from here, the minimap.  node tui.js */
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
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(true); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const build = async () => { await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(300); };
  const mode = () => p.evaluate(() => window.__pg.mode());

  console.log('== Play from here: Play starts where you are working, the start marker is untouched ==');
  await fresh();
  const spawn0 = await p.evaluate(() => window.__pg.spawnY());
  // a floor far from the start, and the view looking at it
  await p.evaluate(([x,y]) => window.__pg.zoomTo(1, x, y), [X+2300, Y]);
  await rect('wood', 1, X+2000, Y+100, X+2600, Y+140);
  await lockAll();
  await p.evaluate(([x,y]) => window.__pg.zoomTo(1, x, y), [X+2300, Y]);
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X, Y]);      // the character is somewhere else, off screen
  await p.waitForTimeout(100);
  ok('the Play-here button shows in Build', await p.evaluate(() => !document.getElementById('playHereBtn').hidden));
  const m = await p.evaluate(() => window.__pg.playHere());
  await p.waitForTimeout(500);
  ok('it enters Play', m === 'play' && (await mode()) === 'play');
  let pp = await pos();
  ok('the character starts at the middle of the view, not at the start', Math.abs(pp.x - (X+2300)) < 60 && pp.y < Y+120, pp);
  ok('and lands on the floor there', pp.y > Y && pp.y < Y+110, pp);
  ok('the button hides in Play', await p.evaluate(() => document.getElementById('playHereBtn').hidden));
  ok('the start marker is where it was', (await p.evaluate(() => window.__pg.spawnY())) === spawn0);
  await p.evaluate(() => window.__pg.respawn());
  await p.waitForTimeout(200);
  pp = await pos();
  ok('a death goes back to the real start', Math.abs(pp.x - (X+2300)) > 500, pp);
  await build();
  ok('leaving Play puts the level back', (await mode()) === 'build');
  await p.evaluate(() => { window.__pg.setMode('play'); }); await p.waitForTimeout(300);
  pp = await pos();
  ok('a plain Play still starts at the start', Math.abs(pp.x - (X+2300)) > 500, pp);
  await build();

  console.log('== Play from here with the character on screen: it starts from where the character stands ==');
  await p.evaluate(([x,y]) => window.__pg.zoomTo(1, x, y), [X+2300, Y]);
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+2100, Y+60]);
  await p.waitForTimeout(100);
  await p.evaluate(() => window.__pg.playHere()); await p.waitForTimeout(400);
  pp = await pos();
  ok('the character is where it stood', Math.abs(pp.x - (X+2100)) < 40, pp);
  ok('asked again in Play it does nothing', (await p.evaluate(() => window.__pg.playHere())) === 'play' && Math.abs((await pos()).x - pp.x) < 5);
  await build();
  await p.evaluate(([x,y]) => window.__pg.zoomTo(1, x, y), [X+2300, Y]);
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+2100, Y+60]);
  await p.keyboard.press('Control+KeyP'); await p.waitForTimeout(400);
  ok('Ctrl+P is the same thing', (await mode()) === 'play' && Math.abs((await pos()).x - (X+2100)) < 40, await pos());
  await build();
  await p.keyboard.press('KeyP'); await p.waitForTimeout(100);
  ok('plain P is still pause', (await mode()) === 'build' && !(await p.evaluate(() => window.__pg.paused())));
  await p.evaluate(() => window.__pg.paused(true));

  console.log('== the minimap ==');
  await fresh();
  let mm = await p.evaluate(() => window.__pg.minimap());
  ok('the minimap shows in Build', !mm.hidden && mm.on, mm);
  await p.evaluate(() => window.__pg.setMode('play')); await p.waitForTimeout(150);
  mm = await p.evaluate(() => window.__pg.minimap());
  ok('and hides in Play', mm.hidden, mm);
  await build();
  const r = await p.evaluate(() => { const r = document.getElementById('minimap').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await p.waitForTimeout(600);
  const fr = (await p.evaluate(() => window.__pg.minimap())).frame;
  await p.mouse.click(r.x + r.w * 0.75, r.y + r.h * 0.5);
  await p.waitForTimeout(100);
  const v = await p.evaluate(() => window.__pg.view());
  const cx = v.x + v.w/2, cy = v.y + v.h/2;
  ok('a click on the map looks there', Math.abs(cx - (fr.x + fr.w * 0.75)) < fr.w * 0.03 && Math.abs(cy - (fr.y + fr.h * 0.5)) < fr.h * 0.05, { cx, cy, fr });
  ok('the map frames the level, not the empty world', fr.w < 4800 && fr.w >= 3200, fr);
  await p.keyboard.press('KeyM'); await p.waitForTimeout(100);
  mm = await p.evaluate(() => window.__pg.minimap());
  ok('M hides it', mm.hidden && !mm.on, mm);
  await p.keyboard.press('KeyM'); await p.waitForTimeout(100);
  mm = await p.evaluate(() => window.__pg.minimap());
  ok('and brings it back', !mm.hidden && mm.on, mm);
  ok('a pixel of the map is painted (the canvas is not blank)', await p.evaluate(() => { const c = document.getElementById('minimap'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n > 100; }));

  console.log('== level pictures: a save takes one, the load list shows it, the autosave keeps it ==');
  await fresh();
  await p.evaluate(() => { localStorage.removeItem('pg_local_levels'); localStorage.removeItem('pg_level_id'); });
  await rect('wood', 1, X-200, Y-100, X+200, Y+100);
  await p.evaluate(() => { document.getElementById('levelNameInput').value = 'Picture test'; window.__pg.doSave(); });
  await p.waitForTimeout(600);
  const locals = await p.evaluate(() => window.__pg.localLevels());
  const th = locals[0] && locals[0].data && locals[0].data.thumb;
  ok('the saved level carries a JPEG picture', typeof th === 'string' && th.startsWith('data:image/jpeg') && th.length > 1500 && th.length < 60000, th && th.length);
  const dims = await p.evaluate(src => new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.width, h: im.height }); im.onerror = () => res(null); im.src = src; }), th);
  ok('192 × 108', dims && dims.w === 192 && dims.h === 108, dims);
  const auto = await p.evaluate(() => { window.__pg.autosave(); return JSON.parse(localStorage.getItem('pg_autosave')).thumb; });
  ok('the autosave carries the last picture', auto === th);
  await p.evaluate(() => window.__pg.openLoad()); await p.waitForTimeout(400);
  const rowPic = await p.evaluate(() => { const t = document.querySelector('#levelList .levelRow .lthumb'); return t ? { none: t.classList.contains('none'), bg: (t.style.backgroundImage || '').slice(0, 30) } : null; });
  ok('the load list shows it', rowPic && !rowPic.none && rowPic.bg.indexOf('data:image/jpeg') >= 0, rowPic);
  await p.evaluate(() => { document.getElementById('closeLoad').click(); });
  // a level without one shows a blank
  await p.evaluate(() => { const list = JSON.parse(localStorage.getItem('pg_local_levels')); delete list[0].data.thumb; localStorage.setItem('pg_local_levels', JSON.stringify(list)); window.__pg.openLoad(); });
  await p.waitForTimeout(400);
  ok('a level with no picture shows a blank, not a broken image', await p.evaluate(() => { const t = document.querySelector('#levelList .levelRow .lthumb'); return t && t.classList.contains('none') && !t.style.backgroundImage; }));
  await p.evaluate(() => { document.getElementById('closeLoad').click(); });
  ok('the picture leaves no interface in the frame (a clean draw does not throw)', await p.evaluate(() => { const t = window.__pg.thumb(); return typeof t === 'string' && t.length > 1000; }));

  ok('no page errors', errs.length === 0, errs);
  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
