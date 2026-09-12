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

  console.log('== tips: one card the first time you try something, never again for that thing ==');
  await fresh();
  ok('the suites run with tips off', !(await p.evaluate(() => window.__pg.tipsOn())) && (await p.evaluate(() => document.getElementById('tipCard').hidden)));
  await p.evaluate(() => { window.__pg.tipsReset(); window.__pg.tipsOn(true); window.__pg.setTool('move'); });
  await p.waitForTimeout(150);
  ok('turned on, the welcome shows first', (await p.evaluate(() => window.__pg.tip())) === 'welcome' && !(await p.evaluate(() => document.getElementById('tipCard').hidden)));
  const shown = await p.evaluate(() => ({ t: document.querySelector('#tipCard .tipTitle').textContent, x: document.querySelector('#tipCard .tipText').textContent }));
  ok('with a title and a sentence', shown.t === 'Welcome to your world' && shown.x.length > 40, shown);
  await p.evaluate(() => window.__pg.setTool('sponge')); await p.waitForTimeout(100);
  const q = await p.evaluate(() => window.__pg.tipQueue());
  ok('the tool in hand and a material picked while a tip is up wait their turn, in order', (await p.evaluate(() => window.__pg.tip())) === 'welcome' && q.join() === 'tool:move,mat:sponge,mode:rect', q);
  await p.click('#tipOk'); await p.waitForTimeout(600);
  ok('Got it closes it and the next comes up', (await p.evaluate(() => window.__pg.tip())) === 'tool:move', await p.evaluate(() => window.__pg.tip()));
  await p.click('#tipOk'); await p.waitForTimeout(600);
  ok('the sponge tip is the material note', (await p.evaluate(() => window.__pg.tip())) === 'mat:sponge' && (await p.evaluate(() => document.querySelector('#tipCard .tipTitle').textContent)).toLowerCase().indexOf('sponge') >= 0);
  await p.click('#tipOk'); await p.waitForTimeout(600);
  ok('the shape mode in hand had queued behind it', (await p.evaluate(() => window.__pg.tip())) === 'mode:rect', await p.evaluate(() => window.__pg.tip()));
  await p.evaluate(() => window.__pg.tipsClear()); await p.waitForTimeout(400);
  await p.evaluate(() => window.__pg.setTool('move')); await p.waitForTimeout(100);
  await p.evaluate(() => window.__pg.tipsClear()); await p.waitForTimeout(400);
  await p.evaluate(() => window.__pg.setTool('sponge')); await p.waitForTimeout(150);
  ok('picking sponge again shows nothing — seen is seen', (await p.evaluate(() => window.__pg.tip())) === null && (await p.evaluate(() => window.__pg.tipPending())) === null, await p.evaluate(() => [window.__pg.tip(), window.__pg.tipPending()]));
  await p.evaluate(() => window.__pg.setTool('motorbolt')); await p.waitForTimeout(150);
  ok('a tool has its own tip', (await p.evaluate(() => window.__pg.tip())) === 'tool:motorbolt', await p.evaluate(() => window.__pg.tip()));
  await p.evaluate(() => window.__pg.tipsClear()); await p.waitForTimeout(400);
  ok('what was seen is remembered on this device', JSON.parse(await p.evaluate(() => localStorage.getItem('pg_tips_seen'))).welcome === 1);
  await p.evaluate(() => { window.__pg.setMode('play'); }); await p.waitForTimeout(200);
  ok('entering Play has a tip', (await p.evaluate(() => window.__pg.tip())) === 'play', await p.evaluate(() => window.__pg.tip()));
  await p.evaluate(() => window.__pg.tipsClear());
  await build();
  await p.evaluate(() => window.__pg.setTool('rope')); await p.waitForTimeout(200);
  ok('another tool, another tip', (await p.evaluate(() => window.__pg.tip())) === 'tool:rope', await p.evaluate(() => window.__pg.tip()));
  await p.click('#tipOff'); await p.waitForTimeout(400);
  ok('No more tips turns them off and closes the card', !(await p.evaluate(() => window.__pg.tipsOn())) && (await p.evaluate(() => window.__pg.tip())) === null && (await p.evaluate(() => localStorage.getItem('pg_tips'))) === '0');
  await p.evaluate(() => window.__pg.setTool('piston')); await p.waitForTimeout(150);
  ok('and nothing shows after that', (await p.evaluate(() => window.__pg.tip())) === null);
  await p.evaluate(() => { window.__pg.tipsReset(); window.__pg.tipsOn(true); });
  await p.waitForTimeout(150);
  ok('Show them all again starts over from the welcome', (await p.evaluate(() => window.__pg.tip())) === 'welcome');
  await p.evaluate(() => { window.__pg.tipOk(); window.__pg.tipsOn(false); });
  const settingsText = await p.evaluate(() => window.__pg.openSettings());
  ok('Settings has the Tips switch and "Show them all again"', settingsText.indexOf('Show them all again') >= 0 && settingsText.indexOf('Tips') >= 0);
  ok('and the stale shortcut notes are gone', settingsText.indexOf('Grapple rope') < 0 && settingsText.indexOf('Tight → Loose') < 0 && settingsText.indexOf('Play from here') >= 0);
  await p.evaluate(() => window.__pg.closePause());
  ok('every tip in the table has a title and text', await p.evaluate(() => Object.keys(window.__pg.tipsTable()).every(k => { const t = window.__pg.tipsTable()[k]; return t && t[0] && t[1] && t[1].length > 20; })));

  console.log('== the device\'s room: a save that does not fit drops the oldest levels, and says so; nothing throws ==');
  await fresh();
  await p.evaluate(() => { localStorage.removeItem('pg_local_levels'); localStorage.removeItem('pg_filler'); window.__pg.setLevelIds(null, null); });
  // three levels of ~200KB, oldest first
  for (let i = 0; i < 3; i++){
    await p.evaluate(i => { const d = window.__pg.serialize('Level ' + i); d.pad = 'x'.repeat(200000); d.updatedAt = 1000 + i; window.__pg.setLevelIds(null, null); window.__pg.saveLocal(d); }, i);
  }
  let names = await p.evaluate(() => window.__pg.localLevels().map(l => l.data.name));
  ok('three levels on the device', names.join() === 'Level 2,Level 1,Level 0', names);
  // fill the rest of the room, leaving about 150KB — less than one level
  const filled = await p.evaluate(() => {
    let lo = 0, hi = 12 * 1024 * 1024, best = 0;
    while (hi - lo > 4096){ const mid = (lo + hi) >> 1; try { localStorage.setItem('pg_filler', 'f'.repeat(mid)); best = mid; lo = mid; } catch (e){ hi = mid; } }
    const room = 150000; const keep = Math.max(0, best - room);
    try { localStorage.setItem('pg_filler', 'f'.repeat(keep)); } catch (e){ return null; }
    return { best, keep };
  });
  ok('the room is nearly full', filled && filled.best > 500000, filled);
  const saved = await p.evaluate(() => { const d = window.__pg.serialize('Level 3'); d.pad = 'x'.repeat(200000); d.updatedAt = 1003; window.__pg.setLevelIds(null, null); return window.__pg.saveLocal(d); });
  names = await p.evaluate(() => window.__pg.localLevels().map(l => l.data.name));
  ok('the new level went in, and the oldest went to make room', saved === true && names[0] === 'Level 3' && names.indexOf('Level 0') < 0 && names.length < 4, names);
  ok('it said so', (await p.evaluate(() => document.getElementById('toast').textContent)).indexOf('out of room') >= 0, await p.evaluate(() => document.getElementById('toast').textContent));
  // no room at all: the save fails cleanly, what was there stays
  await p.evaluate(() => { let lo = 0, hi = 12 * 1024 * 1024, best = 0; while (hi - lo > 2048){ const mid = (lo + hi) >> 1; try { localStorage.setItem('pg_filler', 'f'.repeat(mid)); best = mid; lo = mid; } catch (e){ hi = mid; } } });
  const before = await p.evaluate(() => window.__pg.localLevels().map(l => l.data.name));
  const saved2 = await p.evaluate(() => { const d = window.__pg.serialize('Level 4'); d.pad = 'x'.repeat(3000000); d.updatedAt = 1004; window.__pg.setLevelIds(null, null); return window.__pg.saveLocal(d); });
  const after = await p.evaluate(() => window.__pg.localLevels().map(l => l.data.name));
  ok('a level that cannot fit at all is refused, and the list is untouched', saved2 === false && after.join() === before.join(), { saved2, before, after });
  ok('the autosave does not throw when it cannot fit', (await p.evaluate(() => { try { return { r: window.__pg.autosave(), threw: false }; } catch (e){ return { threw: true }; } })).threw === false);
  await p.evaluate(() => { localStorage.removeItem('pg_filler'); });
  await p.evaluate(() => window.__pg.openLoad()); await p.waitForTimeout(300);
  ok('the load list says how much of the device is used', (await p.evaluate(() => (document.querySelector('#levelList .storageNote') || {}).textContent || '')).indexOf('of about 5MB') >= 0);
  await p.evaluate(() => { document.getElementById('closeLoad').click(); localStorage.removeItem('pg_local_levels'); window.__pg.setLevelIds(null, null); });

  console.log('== backgrounds: drawn in the studio, kept under World, behind the level, saved with it ==');
  await fresh();
  await p.evaluate(() => { localStorage.removeItem('pg_my_skins'); });
  const st = (cmd, a, b2) => p.evaluate(([c, x, y]) => window.__pg.studio(c, x, y), [cmd, a, b2]);
  const stroke = async (x0, y0, x1, y1) => { const r = await st('canvasRect'); await p.mouse.move(r.x + r.w * x0, r.y + r.h * y0); await p.mouse.down(); await p.mouse.move(r.x + r.w * x1, r.y + r.h * y1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(60); };
  const menuPagesWorld = await p.evaluate(() => { window.__pg.menu('world'); return Array.from(document.querySelectorAll('#pmPages button')).map(b => b.textContent.trim()); });
  ok('World has a Background page', menuPagesWorld.includes('Background'), menuPagesWorld);
  await p.evaluate(() => window.__pg.menu(null));
  await p.evaluate(() => window.__pg.bgDraft()); await p.waitForTimeout(250);
  const rr = await st('canvasRect');
  ok('the studio opens on a wide picture', !(await p.evaluate(() => document.getElementById('charEditorOverlay').hidden)) && rr.w > rr.h * 1.8, rr);
  await st('setColor', '#C0392B'); await st('set', 'brush', 0.3);
  await stroke(0.05, 0.5, 0.95, 0.5);
  await st('close'); await p.waitForTimeout(200);
  ok('closing asks for a name', !(await p.evaluate(() => document.getElementById('nameOverlay').hidden)));
  await p.evaluate(() => { document.getElementById('nameInput').value = 'Red band'; document.getElementById('nameOk').click(); }); await p.waitForTimeout(200);
  let mine = await p.evaluate(() => window.__pg.myBackgrounds());
  ok('it is in My Backgrounds', mine.length === 1 && mine[0].name === 'Red band' && mine[0].strokes > 0, mine);
  let bg = await p.evaluate(() => window.__pg.bg());
  ok('and behind the level right away', bg && bg.name === 'Red band', bg);
  await p.waitForTimeout(300);
  const view = await p.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  // the band is drawn across the middle of the picture, the picture is the view's height (and a bit): look along the middle-ish row for red
  const redRow = await p.evaluate(v => { let n = 0; for (let x = 10; x < v.w - 10; x += 20){ for (let y = Math.round(v.h * 0.35); y < v.h * 0.75; y += 6){ const px = window.__pg.pixel(x, y); if (px[0] > 150 && px[1] < 90 && px[2] < 90){ n++; break; } } } return n; }, view);
  ok('the red band is painted across the view, under the level', redRow > 20, redRow);
  await p.evaluate(() => window.__pg.useBackground(null)); await p.waitForTimeout(200);
  const redGone = await p.evaluate(v => { let n = 0; for (let x = 10; x < v.w - 10; x += 20){ for (let y = Math.round(v.h * 0.35); y < v.h * 0.75; y += 6){ const px = window.__pg.pixel(x, y); if (px[0] > 150 && px[1] < 90 && px[2] < 90){ n++; break; } } } return n; }, view);
  ok('the usual scenery has no red in it', redGone === 0 && (await p.evaluate(() => window.__pg.bg())) === null, redGone);
  await p.evaluate(id => window.__pg.useBackground(id), mine[0].id); await p.waitForTimeout(100);
  // a plain colour behind it
  await p.evaluate(() => window.__pg.bgPlain('#0B1026')); await p.waitForTimeout(200);
  const corner = await p.evaluate(() => window.__pg.pixel(30, 30));
  ok('a plain colour behind the picture replaces the sky', corner[0] < 40 && corner[1] < 40 && corner[2] < 70, corner);
  // it slides: the band's x position on screen barely moves for a big camera move
  await p.evaluate(() => window.__pg.bgSlide(0.25));
  const data1 = await p.evaluate(() => window.__pg.serialize('bg test'));
  ok('the level file carries the background, the colour and the distance', data1.world.bg && data1.world.bg.name === 'Red band' && data1.world.bg.art.length > 0 && data1.world.bgPlain === '#0B1026' && data1.world.bgSlide === 0.25, data1.world.bg && [data1.world.bgPlain, data1.world.bgSlide]);
  await p.evaluate(() => { window.__pg.useBackground(null); window.__pg.bgPlain(null); window.__pg.bgSlide(0.5); });
  await p.evaluate(d => window.__pg.load(d), data1); await p.waitForTimeout(200);
  bg = await p.evaluate(() => window.__pg.bg());
  ok('and loading it brings all three back', bg && bg.name === 'Red band' && (await p.evaluate(() => window.__pg.bgPlain())) === '#0B1026' && (await p.evaluate(() => window.__pg.bgSlide())) === 0.25, bg);
  // Play keeps it; Build gets it back
  await p.evaluate(() => window.__pg.setMode('play')); await p.waitForTimeout(150);
  ok('Play keeps it', (await p.evaluate(() => window.__pg.bg())) !== null);
  await build();
  ok('and so does coming back', (await p.evaluate(() => window.__pg.bg())) !== null);
  // a level with a bad background field loads with none, not an error
  const bad = JSON.parse(JSON.stringify(data1)); bad.world.bg = { id: 3, art: 'nope' }; bad.world.bgPlain = 'red'; bad.world.bgSlide = 'far';
  await p.evaluate(d => window.__pg.load(d), bad); await p.waitForTimeout(150);
  ok('a level with a broken background loads with the usual scenery', (await p.evaluate(() => window.__pg.bg())) === null && (await p.evaluate(() => window.__pg.bgPlain())) === null && (await p.evaluate(() => window.__pg.bgSlide())) === 0.25);
  // editing the saved one updates the level using it
  await p.evaluate(d => window.__pg.load(d), data1); await p.waitForTimeout(150);
  const strokesBefore = (await p.evaluate(() => window.__pg.bg())).strokes;
  await p.evaluate(() => window.__pg.bgEdit(0)); await p.waitForTimeout(250);
  await st('setColor', '#2ECC71'); await stroke(0.1, 0.2, 0.9, 0.2);
  await st('close'); await p.waitForTimeout(200);
  bg = await p.evaluate(() => window.__pg.bg());
  ok('editing the saved background updates the level that uses it', bg && bg.strokes > strokesBefore, { before: strokesBefore, after: bg && bg.strokes });
  ok('the studio does not ask for a name again', await p.evaluate(() => document.getElementById('nameOverlay').hidden));

  ok('no page errors', errs.length === 0, errs);
  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
