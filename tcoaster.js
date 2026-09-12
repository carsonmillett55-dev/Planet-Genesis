/* The rollercoaster: a track drawn as a line, the coaster waiting at its
   start, F to ride, the run to the end and the stop, hopping off, the
   glide back, more seats coupled along the rail, the pace, a drawn seat,
   the box, save/load, two riders.  node tcoaster.js */
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
  const tracks = () => p.evaluate(() => window.__pg.tracks());
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const players = () => p.evaluate(() => window.__pg.players());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(true); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const build = async () => { await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(300); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };
  const standAt2 = async (i, x, y) => { await p.evaluate(([i,x,y]) => window.__pg.playerTo2(i,x,y), [i,x,y]); await p.waitForTimeout(350); };
  const pad = (over) => { const bt = []; for (let i = 0; i < 17; i++) bt.push({ pressed: false, value: 0 }); const g = { connected: true, axes: [0, 0, 0, 0], buttons: bt }; if (over){ if (over.axes) g.axes = over.axes; (over.press || []).forEach(i => { bt[i].pressed = true; bt[i].value = 1; }); } return g; };
  const pads = async (list) => { await p.evaluate(l => window.__pg.fakePads(l), list); await p.waitForTimeout(80); };
  const toast = () => p.evaluate(() => document.getElementById('toast').textContent);
  // draw a track with the tool: a drag along the given world points
  async function drawTrack(pts){
    await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('track'); });
    const a = await w2p(pts[0][0], pts[0][1]);
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    for (let i = 1; i < pts.length; i++){ const c = await w2p(pts[i][0], pts[i][1]); await p.mouse.move(c.x, c.y, { steps: 8 }); }
    await p.mouse.up(); await p.waitForTimeout(150);
  }

  console.log('== the track tool draws a line, not material ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+800, Y+140);   // a floor
  await lockAll();
  const objs0 = await p.evaluate(() => window.__pg.objects().length);
  ok('the tool is on the Gameplay page', await p.evaluate(() => { window.__pg.menu('toolsbag'); const pg = Array.from(document.querySelectorAll('#pmPages button')).filter(b => b.textContent.trim() === 'Gameplay')[0]; pg.click(); return /Coaster track/.test(document.getElementById('pmBody').innerText); }));
  await p.evaluate(() => window.__pg.menu(null));
  await drawTrack([[X-300, Y+60], [X-100, Y+60], [X+100, Y-40], [X+300, Y-40]]);   // flat, a climb, flat
  let ts = await tracks();
  ok('a drag with the track tool makes a track — and no object', ts.length === 1 && (await p.evaluate(() => window.__pg.objects().length)) === objs0, { tracks: ts.length });
  ok('resampled along the line, about 600px long, one seat waiting at the start', ts[0].n > 40 && ts[0].len > 560 && ts[0].len < 700 && ts[0].seats === 1 && ts[0].state === 'wait' && Math.abs(ts[0].start.x - (X-300)) < 12, ts[0]);
  ok('selected, and the toast says how to ride', /press F to ride/.test(await toast()));
  ok('the seat sits on the rail, lifted up off it', Math.abs(ts[0].seat0.x - ts[0].start.x) < 4 && ts[0].seat0.y < ts[0].start.y - 8, ts[0].seat0);

  console.log('== ride it: F sits you in, it runs to the end and stops ==');
  await play(); await standAt(X-300, Y+40);
  await p.waitForTimeout(300);
  ok('the prompt: not riding yet', (await p.evaluate(() => window.__pg.riding())) === null);
  await p.keyboard.press('KeyF'); await p.waitForTimeout(100);
  ok('F sits you in the front seat', JSON.stringify(await p.evaluate(() => window.__pg.riding())) === JSON.stringify({ track: (await tracks())[0].id, seat: 0 }), await p.evaluate(() => window.__pg.riding()));
  await p.waitForTimeout(1100);
  ts = await tracks();
  ok('a moment later it sets off', ts[0].state === 'run' && ts[0].s > 20, ts[0]);
  const mid = await pos();
  ok('and carries you along the rail', mid.x > X-300 + 30, mid);
  let ended = false; for (let i = 0; i < 60 && !ended; i++){ await p.waitForTimeout(100); ended = (await tracks())[0].state === 'end'; }
  ts = await tracks();
  ok('it stops at the end of the line', ended && Math.abs(ts[0].s - ts[0].len) < 1, ts[0]);
  const atEnd = await pos();
  ok('with you at the end, up the climb', Math.abs(atEnd.x - (X+300)) < 40 && atEnd.y < Y - 30, atEnd);
  ok('still riding', (await p.evaluate(() => window.__pg.riding())) !== null);
  await p.keyboard.press('Space'); await p.waitForTimeout(80);
  ok('Space hops off', (await p.evaluate(() => window.__pg.riding())) === null && (await tracks())[0].riders.length === 0);
  await p.waitForTimeout(1100);
  const hopped = await pos();
  ok('you fall to the floor', hopped.y > atEnd.y + 40, { atEnd, hopped });
  let back = false; for (let i = 0; i < 80 && !back; i++){ await p.waitForTimeout(100); back = (await tracks())[0].state === 'wait'; }
  ok('empty, the coaster glides back to the start and waits', back && (await tracks())[0].s === 0, await tracks());   // one seat: the front seat is at the very start

  console.log('== more seats, coupled along the rail; the pace ==');
  await build();
  ok('a click on the rail selects the track', await p.evaluate(() => window.__pg.selectTrack(0)) && (await p.evaluate(() => document.getElementById('opBody').innerText)).indexOf('Seats') >= 0);
  await p.evaluate(() => window.__pg.trackSet(0, { seats: 4, pace: 6 }));
  ts = await tracks();
  ok('four seats, a faster pace — the front seat waits a whole train in, so the whole train is on the rail', ts[0].seats === 4 && ts[0].pace === 6 && Math.abs(ts[0].s - 3 * ts[0].gap) < 1, ts[0]);
  await play(); await standAt(X-300 + 3 * 64, Y+40); await p.waitForTimeout(200);   // beside the front seat
  await p.keyboard.press('KeyF'); await p.waitForTimeout(1200);
  ts = await tracks();
  ok('it goes at the pace: further along after a second', ts[0].state === 'run' && ts[0].v >= 6 && ts[0].s > 100, ts[0]);
  const seatsNow = await p.evaluate(() => { const t = window.__pg.tracks()[0]; return t; });
  ok('the front seat is where the coaster is', Math.abs(seatsNow.seat0.x - (X-300 + seatsNow.s)) < 30 || seatsNow.s > 200, seatsNow);
  ended = false; for (let i = 0; i < 40 && !ended; i++){ await p.waitForTimeout(100); ended = (await tracks())[0].state === 'end'; }
  ok('and reaches the end', ended);
  await p.keyboard.press('Space'); await p.waitForTimeout(100);
  await build();

  console.log('== a drawn seat, the box, save and load ==');
  await p.evaluate(() => window.__pg.selectTrack(0));
  ok('the box offers to draw the seat', /Draw the seat/.test(await p.evaluate(() => document.getElementById('opBody').innerText)));
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#opBody button')).filter(q => /Draw the seat/.test(q.textContent))[0]; b.click(); });
  await p.waitForTimeout(300);
  ok('the studio opens on the seat', !(await p.evaluate(() => document.getElementById('charEditorOverlay').hidden)) && /Coaster seat/.test(await p.evaluate(() => document.getElementById('charEditorOverlay').innerText)));
  // a stroke in the studio, then close
  const st = await p.evaluate(() => { const c = document.getElementById('ceCanvas') || document.querySelector('#charEditorOverlay canvas'); const r = c.getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.5, x2: r.left + r.width * 0.7 }; });
  await p.mouse.move(st.x, st.y); await p.mouse.down(); await p.mouse.move(st.x2, st.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
  await p.evaluate(() => window.__pg.studio('close'));
  await p.waitForTimeout(300);
  ts = await tracks();
  ok('closing keeps the drawn seat on the track', ts[0].look === true, ts[0]);
  const file = await p.evaluate(() => window.__pg.serialize());
  ok('the level file carries the track, its seats, pace and look', file.tracks && file.tracks.length === 1 && file.tracks[0].seats === 4 && file.tracks[0].pace === 6 && !!file.tracks[0].look && file.tracks[0].pts.length > 40, file.tracks && file.tracks[0] && { seats: file.tracks[0].seats, pace: file.tracks[0].pace, look: !!file.tracks[0].look, n: file.tracks[0].pts.length });
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); });
  ok('cleared, no tracks', (await tracks()).length === 0);
  await p.evaluate(f => window.__pg.load(f), file); await p.waitForTimeout(200);
  ts = await tracks();
  ok('loaded back whole', ts.length === 1 && ts[0].seats === 4 && ts[0].pace === 6 && ts[0].look && ts[0].len > 560, ts[0]);
  ok('Del removes it', await p.evaluate(() => window.__pg.selectTrack(0)) && (await (async () => { await p.keyboard.press('Delete'); await p.waitForTimeout(100); return (await tracks()).length === 0; })()));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  ok('and undo brings it back', (await tracks()).length === 1);

  console.log('== two riders, two seats ==');
  await p.evaluate(() => window.__pg.trackSet(0, { seats: 2, pace: 3 }));
  await play();
  await pads([pad(), pad({ press: [9] })]); await p.waitForTimeout(120); await pads([pad(), pad()]); await p.waitForTimeout(150);
  ok('a second player joined', (await players()).length === 2);
  await standAt(X-300 + 64, Y+40); await standAt2(1, X-300, Y+40); await p.waitForTimeout(200);   // two seats: the front one a seat in, the second at the start
  await p.keyboard.press('KeyF'); await p.waitForTimeout(100);
  ok('player one takes the front seat', JSON.stringify(await p.evaluate(() => window.__pg.riding())) === JSON.stringify({ track: (await tracks())[0].id, seat: 0 }));
  await pads([pad(), pad({ press: [3] })]); await p.waitForTimeout(120); await pads([pad(), pad()]);
  ts = await tracks();
  ok('Y on the pad sits player two in the seat behind', ts[0].riders.length === 2, ts[0]);
  await p.waitForTimeout(1500);
  const two = await players();
  ts = await tracks();
  ok('the train runs with both aboard, one seat apart along the rail', ts[0].state === 'run' && Math.abs(Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y) - ts[0].gap) < 14, { d: Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y), state: ts[0].state });
  await build();
  ok('back in Build the coaster is at its start with nobody in it', (await tracks())[0].state === 'wait' && (await tracks())[0].riders.length === 0 && (await p.evaluate(() => window.__pg.riding())) === null);
  await pads([pad(), null]); await p.evaluate(() => { window.__pgFakePads = null; window.__pgFakePad = undefined; });

  console.log('== no page errors ==');
  ok('no errors', errs.length === 0, errs);
  await b.close();
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  process.exit(fail ? 1 : 0);
})();
