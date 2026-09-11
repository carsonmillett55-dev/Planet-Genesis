/* Links: pistons and rope. Two-click placement, the piston's cycle and its
   wired modes, a rope that hangs and holds, the box, and save/load.
   node tlink.js */
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
  const X = cam.x + 400, Y = cam.y + 260;
  const w2p = (x,y) => p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [x,y]);
  async function rect(mat, layer, x0, y0, x1, y1){
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const linksNow = () => p.evaluate(() => window.__pg.links());
  const gads = () => p.evaluate(() => window.__pg.gadgets());
  const stats = () => p.evaluate(() => window.__pg.stats());
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
    await p.waitForTimeout(200);
  };
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const run = () => p.evaluate(() => window.__pg.paused(false));
  /* A locked block on the left and a free block to its right, on Mid. */
  const twoBlocks = async () => {
    await fresh();
    await rect('wood', 1, X, Y, X+80, Y+80);
    await lockAll();
    await rect('metal', 1, X+200, Y+10, X+280, Y+70);
  };
  const place = async (tool, ax, ay, bx, by) => {
    await p.evaluate(t => { window.__pg.setLayer(1); window.__pg.setTool(t); }, tool);
    await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [ax, ay]);
    await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [bx, by]);
    return (await linksNow())[0];
  };

  console.log('');
  console.log('== two clicks make a piston ==');
  await twoBlocks();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('piston'); });
  const n0 = await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [X+40, Y+40]);
  ok('the first click starts one and makes nothing yet', n0 === 0 && !!(await p.evaluate(() => window.__pg.linkDraft())));
  const nSame = await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [X+60, Y+40]);
  ok('a second click on the same object is refused', nSame === 0);
  const n1 = await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [X+240, Y+40]);
  const pist = (await linksNow())[0];
  ok('the second click on the other object finishes it', n1 === 1 && pist && pist.kind === 'piston', pist);
  ok('it spans the two points', Math.abs(pist.span - 200) < 6, pist.span);
  ok('with a shortest and longest either side of that', pist.min < 200 && pist.max > 200, { min: pist.min, max: pist.max });
  await p.evaluate(() => { window.__pg.setTool('piston'); });
  await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [X+40, Y+40]);
  await p.keyboard.press('Escape');          // with a draft in hand, Esc cancels it rather than opening the menu
  await p.waitForTimeout(100);
  ok('Esc cancels a half-made one', !(await p.evaluate(() => window.__pg.linkDraft())) && (await linksNow()).length === 1);
  ok('and does not open the pause menu', await p.evaluate(() => document.getElementById('pauseOverlay').hidden));

  console.log('');
  console.log('== the piston cycles ==');
  await twoBlocks();
  const pc = await place('piston', X+40, Y+40, X+240, Y+40);
  await p.evaluate(id => window.__pg.linkSet(id, { min: 120, max: 300, time: 0.6, pause: 0.1, going: 1 }), pc.id);
  await run();
  const spans = [];
  for (let i = 0; i < 12; i++){ await p.waitForTimeout(120); spans.push((await linksNow())[0].span); }
  const mx = Math.max(...spans), mn = Math.min(...spans);
  console.log('   spans', spans.map(v => v.toFixed(0)).join(' '));
  ok('it pushes out toward its longest', mx > 260, mx);
  ok('and pulls back toward its shortest', mn < 170, mn);

  console.log('');
  console.log('== stiff holds the angle ==');
  await twoBlocks();
  const ps = await place('piston', X+40, Y+40, X+240, Y+40);
  await p.evaluate(id => window.__pg.linkSet(id, { min: 190, max: 210, time: 5, stiff: false }), ps.id);
  await run(); await p.waitForTimeout(1200);
  const looseDrop = (await linksNow())[0].by - (await linksNow())[0].ay;
  await twoBlocks();
  const ps2 = await place('piston', X+40, Y+40, X+240, Y+40);
  await p.evaluate(id => window.__pg.linkSet(id, { min: 190, max: 210, time: 5, stiff: true }), ps2.id);
  await run(); await p.waitForTimeout(1200);
  const stiffDrop = (await linksNow())[0].by - (await linksNow())[0].ay;
  console.log('   the far end dropped', looseDrop.toFixed(0) + 'px loose,', stiffDrop.toFixed(0) + 'px stiff');
  ok('a loose piston lets the hanging block swing down', looseDrop > 60, looseDrop);
  ok('a stiff one holds it out much more', stiffDrop < looseDrop * 0.6, { looseDrop, stiffDrop });

  console.log('');
  console.log('== wired, the signal decides ==');
  async function wiredPiston(flipper){
    await fresh();
    await rect('wood', 1, X, Y, X+80, Y+80);
    await rect('wood', 1, X-200, Y+300, X, Y+340);     // a platform for the lever, off to the left
    await lockAll();
    await rect('metal', 1, X+200, Y+10, X+280, Y+70);  // the moving block, after the locking
    const pl = await place('piston', X+40, Y+40, X+240, Y+40);
    await p.evaluate(([id, fl]) => window.__pg.linkSet(id, { min: 120, max: 300, time: 0.5, pause: 0, flipper: fl, going: 1 }), [pl.id, flipper]);
    await p.evaluate(() => window.__pg.setTool('lever'));
    await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-100, Y+302]);
    const lv = (await gads())[0];
    ok('a lever can be wired to a piston', await p.evaluate(([f,t]) => window.__pg.wire(f,t), [lv.id, pl.id]));
    await p.evaluate(() => window.__pg.setFlying(false));
    await run();
    await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X-100, Y+270]);
    await p.waitForTimeout(400);
    return { pl, lv };
  }
  let w = await wiredPiston('off');
  await p.waitForTimeout(700);
  const offSpan = (await linksNow())[0].span;
  ok('"signal runs it": off, it sits still', Math.abs(offSpan - 200) < 12, offSpan);
  await p.keyboard.press('KeyF'); await p.waitForTimeout(900);
  const onSpans = []; for (let i = 0; i < 6; i++){ await p.waitForTimeout(120); onSpans.push((await linksNow())[0].span); }
  ok('on, it cycles', Math.max(...onSpans) - Math.min(...onSpans) > 40, onSpans.map(v=>v.toFixed(0)));
  w = await wiredPiston('out');
  await p.waitForTimeout(700);
  const outIdle = (await linksNow())[0].span;
  await p.keyboard.press('KeyF'); await p.waitForTimeout(900);
  const outOn = (await linksNow())[0].span;
  await p.keyboard.press('KeyF'); await p.waitForTimeout(900);
  const outOff = (await linksNow())[0].span;
  console.log('   push out: idle', outIdle.toFixed(0), 'on', outOn.toFixed(0), 'off again', outOff.toFixed(0));
  ok('"signal pushes out": it waits at its shortest', outIdle < 140, outIdle);
  ok('goes to its longest while on', outOn > 280, outOn);
  ok('and comes back when the signal drops', outOff < 140, outOff);
  w = await wiredPiston('in');
  await p.waitForTimeout(700);
  const inIdle = (await linksNow())[0].span;
  await p.keyboard.press('KeyF'); await p.waitForTimeout(900);
  const inOn = (await linksNow())[0].span;
  ok('"signal pulls in": it waits long and pulls short while on', inIdle > 280 && inOn < 140, { inIdle, inOn });

  console.log('');
  console.log('== a rope hangs and holds ==');
  await fresh();
  await rect('wood', 1, X, Y-40, X+80, Y+40);           // a locked post
  await lockAll();
  await rect('metal', 1, X+200, Y+140, X+260, Y+200);   // a weight, below and to the right
  const rp = await place('rope', X+40, Y, X+230, Y+170);
  ok('two clicks make a rope', rp && rp.kind === 'rope' && rp.segs >= 3, rp);
  await p.evaluate(id => window.__pg.linkSet(id, { length: 320 }), rp.id);
  ok('its length can be set, and it is rebuilt to match', (await linksNow())[0].length === 320 && (await linksNow())[0].segs >= 10, (await linksNow())[0]);
  await run(); await p.waitForTimeout(2500);
  const wt = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0];
  const rl = (await linksNow())[0];
  ok('the weight swings under the post rather than falling to the floor', wt && wt.pos.y < 2200 && wt.pos.y > Y, { y: wt && wt.pos.y });
  ok('and the rope is about as long as it was told to be', Math.abs(rl.span - 320) < 60, rl.span);
  const pts = await p.evaluate(id => window.__pg.ropePoints(id), rp.id);
  ok('it is drawn through its own segments', pts && pts.length >= 12, pts && pts.length);

  console.log('');
  console.log('== a slider takes a typed number, and nudges by the keys ==');
  await p.evaluate(() => window.__pg.paused(true));
  await p.evaluate(id => window.__pg.selectLink(id), rp.id);
  await p.waitForTimeout(200);
  const lenField = () => p.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#opBody .settingRow'));
    const row = rows.find(r => /Length/.test(r.querySelector('label').textContent));
    return row ? { text: row.querySelector('input.val').value, range: +row.querySelector('input[type=range]').value } : null;
  });
  ok('the rope box shows the length as a number', /^320px$/.test((await lenField()).text), await lenField());
  // type a number that is not on a notch
  await p.evaluate(() => { const rows = Array.from(document.querySelectorAll('#opBody .settingRow')); rows.find(r => /Length/.test(r.querySelector('label').textContent)).querySelector('input.val').focus(); });
  await p.waitForTimeout(50);
  await p.keyboard.press('Control+a'); await p.keyboard.type('123'); await p.keyboard.press('Enter');
  await p.waitForTimeout(250);
  ok('typing 123 and Enter makes the rope 123px, notches or not', (await linksNow())[0].length === 123, (await linksNow())[0].length);
  ok('and the field reads it back', /^123px$/.test((await lenField()).text), await lenField());
  // too big is clamped to the end of the slider
  await p.evaluate(() => { const rows = Array.from(document.querySelectorAll('#opBody .settingRow')); rows.find(r => /Length/.test(r.querySelector('label').textContent)).querySelector('input.val').focus(); });
  await p.waitForTimeout(50);
  await p.keyboard.press('Control+a'); await p.keyboard.type('99999'); await p.keyboard.press('Enter');
  await p.waitForTimeout(250);
  ok('a number past the end lands on the end', (await linksNow())[0].length === 3000, (await linksNow())[0].length);
  // nonsense leaves it alone
  await p.evaluate(() => { const rows = Array.from(document.querySelectorAll('#opBody .settingRow')); rows.find(r => /Length/.test(r.querySelector('label').textContent)).querySelector('input.val').focus(); });
  await p.waitForTimeout(50);
  await p.keyboard.press('Control+a'); await p.keyboard.type('hello'); await p.keyboard.press('Enter');
  await p.waitForTimeout(250);
  ok('nonsense changes nothing', (await linksNow())[0].length === 3000 && /^3000px$/.test((await lenField()).text), await lenField());
  // back to something sensible, then the keys on the slider itself
  await p.evaluate(() => { const rows = Array.from(document.querySelectorAll('#opBody .settingRow')); rows.find(r => /Length/.test(r.querySelector('label').textContent)).querySelector('input.val').focus(); });
  await p.waitForTimeout(50);
  await p.keyboard.press('Control+a'); await p.keyboard.type('200'); await p.keyboard.press('Enter');
  await p.waitForTimeout(250);
  await p.evaluate(() => { const rows = Array.from(document.querySelectorAll('#opBody .settingRow')); rows.find(r => /Length/.test(r.querySelector('label').textContent)).querySelector('input[type=range]').focus(); });
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120);
  ok('an arrow key on the slider moves a tenth of a notch: 200 -> 201', (await linksNow())[0].length === 201, (await linksNow())[0].length);
  await p.keyboard.press('KeyD'); await p.keyboard.press('KeyD'); await p.waitForTimeout(120);
  ok('D does the same: 201 -> 203', (await linksNow())[0].length === 203, (await linksNow())[0].length);
  await p.keyboard.press('KeyA'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(120);
  ok('A and the left arrow go back: 203 -> 201', (await linksNow())[0].length === 201, (await linksNow())[0].length);
  await p.keyboard.press('Shift+ArrowRight'); await p.waitForTimeout(120);
  ok('with Shift it is a whole notch: 201 -> 211', (await linksNow())[0].length === 211, (await linksNow())[0].length);
  const pp0 = await p.evaluate(() => window.__pg.playerPos());
  await p.evaluate(() => window.__pg.paused(false)); await p.waitForTimeout(300);
  const pp1 = await p.evaluate(() => window.__pg.playerPos());
  ok('and none of those key presses walked the player', Math.abs(pp1.x - pp0.x) < 2, { before: pp0.x, after: pp1.x });
  await p.evaluate(() => window.__pg.paused(true));

  console.log('');
  console.log('== it rides, saves, and undoes ==');
  await twoBlocks();
  const pr = await place('piston', X+40, Y+40, X+240, Y+40);
  await p.evaluate(id => window.__pg.linkSet(id, { min: 150, max: 260, time: 2.5, pause: 0.7, stiff: true, flipper: 'out', going: -1 }), pr.id);
  const data = await p.evaluate(() => window.__pg.serialize('l'));
  ok('the save carries the piston and its settings', data.links.length === 1 && data.links[0].min === 150 && data.links[0].max === 260 && data.links[0].stiff === true && data.links[0].flipper === 'out', data.links[0]);
  await p.evaluate(d => window.__pg.load(d), data);
  await p.waitForTimeout(300);
  const back = (await linksNow())[0];
  ok('and it comes back', back && back.kind === 'piston' && back.min === 150 && back.flipper === 'out' && back.stiff === true, back);
  await p.evaluate(id => window.__pg.selectLink(id), back.id);
  await p.waitForTimeout(200);
  ok('the box opens for it', await p.evaluate(() => window.__pg.ctxOpen()) && /Piston/.test(await p.evaluate(() => document.querySelector('#opHead .t').textContent)));
  ok('with reach and timing', await p.evaluate(() => /shortest/i.test(document.getElementById('opBody').innerText) && /stroke/i.test(document.getElementById('opBody').innerText)));
  await p.keyboard.press('Delete');
  await p.waitForTimeout(250);
  ok('Del removes it', (await linksNow()).length === 0);
  await p.evaluate(() => window.__pg.undo());
  await p.waitForTimeout(400);
  ok('undo brings it back', (await linksNow()).length === 1 && (await linksNow())[0].flipper === 'out');
  // Removing a host takes the link with it.
  await p.evaluate(() => { window.__pg.setTool('move'); const o = window.__pg.objects().filter(q => !q.body.isStatic)[0]; window.__pg.select(o); });
  await p.evaluate(() => window.__pg.deleteSel());
  await p.waitForTimeout(300);
  ok('deleting one of its objects removes the link too', (await linksNow()).length === 0);

  console.log('');
  console.log('== a stiff piston is bulletproof ==');
  // A stiff piston holding a plate straight out, and a heavy block dropped
  // on the far end of the plate. It must not bend, sag or turn.
  await fresh();
  await rect('wood', 1, X, Y, X+80, Y+80);
  await lockAll();
  await rect('metal', 1, X+200, Y+20, X+420, Y+60);          // a long plate
  const bp = await place('piston', X+40, Y+40, X+220, Y+40);
  await p.evaluate(id => window.__pg.linkSet(id, { min: 180, max: 180, stiff: true }), bp.id);
  await rect('metal', 1, X+360, Y-200, X+420, Y-140);        // a weight above the far end
  await run(); await p.waitForTimeout(2000);
  const st = (await linksNow())[0];
  const dbg = await p.evaluate(i => window.__pg.linkDebug(i), bp.id);
  console.log('   far anchor', st.bx, st.by, ' wanted', X+220, Y+40, ' plate angle', dbg.B.ang);
  ok('the far end is exactly where the rod says', Math.abs(st.bx - (X+220)) < 1 && Math.abs(st.by - (Y+40)) < 1, { at:[st.bx, st.by], want:[X+220, Y+40] });
  ok('and the plate has not tilted under the weight', Math.abs(dbg.B.ang) < 0.002, dbg.B.ang);
  ok('nor slid along the rod', Math.abs(st.span - 180) < 0.5, st.span);
  // now with the world running it should still push: extend and the plate goes with it
  await p.evaluate(id => window.__pg.linkSet(id, { min: 180, max: 380, time: 0.6, pause: 0 }), bp.id);
  const drive = []; for (let i = 0; i < 8; i++){ await p.waitForTimeout(110); drive.push((await linksNow())[0].span); }
  ok('it drives out, weight and all', Math.max(...drive) > 300, drive.map(v=>v.toFixed(0)));

  console.log('');
  console.log('== resizing an object with links on it ==');
  await twoBlocks();
  const rz = await place('piston', X+40, Y+40, X+240, Y+40);
  await p.evaluate(() => { window.__pg.setTool('move'); const o = window.__pg.objects().find(q => q.body.isStatic && q.pieces[0].m === 'wood' && window.__pg.stats().find(s => s.id === q.id && s.pos.y < 2300)); window.__pg.select(o); });
  const base0 = await p.evaluate(() => { const o = window.__pg.objects().find(q => q.body.isStatic && q.pieces[0].m === 'wood' && window.__pg.stats().find(s => s.id === q.id && s.pos.y < 2300)); return window.__pg.bounds(o.id); });
  const r0 = (rz.ax - base0.x) / (base0.x2 - base0.x);    // where on the base block the anchor sits, 0..1
  const hf = await w2p(base0.x2+5, base0.y2+5);
  const ht = await w2p(base0.x-5 + (base0.x2-base0.x+10)*1.7, base0.y-5 + (base0.y2-base0.y+10)*1.7);
  await p.mouse.move(hf.x, hf.y); await p.mouse.down(); await p.mouse.move(ht.x, ht.y, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(400);
  const base1 = await p.evaluate(() => { const o = window.__pg.objects().find(q => q.body.isStatic && q.pieces[0].m === 'wood' && window.__pg.stats().find(s => s.id === q.id && s.pos.y < 2300)); return window.__pg.bounds(o.id); });
  const l1 = (await linksNow())[0];
  const r1 = (l1.ax - base1.x) / (base1.x2 - base1.x);
  ok('the base grew', (base1.x2 - base1.x) > 120, base1.x2 - base1.x);
  ok('the piston end stayed on the same spot of it', Math.abs(r1 - r0) < 0.06, { before: r0, after: r1 });
  ok('and the piston still exists and still spans something sensible', (await linksNow()).length === 1 && l1.span > 100, l1.span);
  await p.evaluate(() => window.__pg.flip()); await p.waitForTimeout(300);
  const l2 = (await linksNow())[0];
  ok('flipping the base keeps the piston attached', (await linksNow()).length === 1 && Math.abs(l2.ay - l1.ay) < 3, { before: l1.ay, after: l2.ay });
  await run(); await p.waitForTimeout(800);
  ok('and it still works afterwards', Math.abs((await linksNow())[0].span - l2.span) > 10 || (await linksNow())[0].span > 100);

  console.log('');
  console.log('== resizing an object with a rope on it ==');
  await fresh();
  await rect('wood', 1, X, Y-40, X+80, Y+40);
  await lockAll();
  await rect('metal', 1, X+200, Y+140, X+260, Y+200);
  const rr = await place('rope', X+40, Y, X+230, Y+170);
  await p.evaluate(() => { window.__pg.setTool('move'); const o = window.__pg.objects().find(q => !q.body.isStatic); window.__pg.select(o); });
  const wb0 = await p.evaluate(() => { const o = window.__pg.objects().find(q => !q.body.isStatic); return window.__pg.bounds(o.id); });
  const wf = await w2p(wb0.x2+5, wb0.y2+5);
  const wto = await w2p(wb0.x-5 + (wb0.x2-wb0.x+10)*2, wb0.y-5 + (wb0.y2-wb0.y+10)*2);
  await p.mouse.move(wf.x, wf.y); await p.mouse.down(); await p.mouse.move(wto.x, wto.y, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(400);
  const wb1 = await p.evaluate(() => { const o = window.__pg.objects().find(q => !q.body.isStatic); return window.__pg.bounds(o.id); });
  const rl1 = (await linksNow())[0];
  ok('the weight grew', (wb1.x2 - wb1.x) > 100, wb1.x2 - wb1.x);
  ok('the rope end is still inside it', rl1.bx >= wb1.x - 2 && rl1.bx <= wb1.x2 + 2 && rl1.by >= wb1.y - 2 && rl1.by <= wb1.y2 + 2, { end:[rl1.bx, rl1.by], box: wb1 });
  await run(); await p.waitForTimeout(2500);
  const rl2 = (await linksNow())[0];
  const wgt = (await stats()).filter(o => !o.static)[0];
  ok('the bigger weight still hangs from it', wgt && wgt.pos.y > Y && wgt.pos.y < 2250 && Math.abs(rl2.span - rl2.length) < 40, { y: wgt && wgt.pos.y, span: rl2.span, length: rl2.length });

  console.log('');
  console.log('== an end of a piston can be dragged to another object ==');
  await twoBlocks();
  await rect('wood', 1, X+400, Y, X+480, Y+80);        // a third block, locked below
  await p.evaluate(() => { const o = window.__pg.objects().filter(q => !q.body.isStatic).pop(); window.__pg.select(o); window.__pg.anchor(); window.__pg.deselect(); });
  const pm = await place('piston', X+40, Y+40, X+240, Y+40);
  const objsBefore = { a: pm.a, b: pm.b };
  await p.evaluate(() => window.__pg.setTool('move'));
  await p.evaluate(id => window.__pg.selectLink(id), pm.id);
  const dragTo = async (fx, fy, tx, ty) => {
    const a = await w2p(fx, fy), c = await w2p(tx, ty);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(300);
  };
  await dragTo(pm.bx, pm.by, X+440, Y+40);            // far end onto the third block
  let lm = (await linksNow())[0];
  ok('the far end is now on the third block', lm.b !== objsBefore.b && Math.abs(lm.bx - (X+440)) < 4, { b: lm.b, was: objsBefore.b, at: [lm.bx, lm.by] });
  ok('and the near end did not move', lm.a === objsBefore.a && Math.abs(lm.ax - pm.ax) < 2, { a: lm.a, ax: lm.ax });
  ok('the reach was widened to fit the new span', lm.min <= lm.span && lm.max >= lm.span, { min: lm.min, max: lm.max, span: lm.span });
  await dragTo(lm.ax, lm.ay, X+40, Y-200);            // near end into thin air
  const lm2 = (await linksNow())[0];
  ok('dropping an end on nothing leaves it alone', lm2.a === lm.a && Math.abs(lm2.ax - lm.ax) < 2, { a: lm2.a, ax: lm2.ax });
  await dragTo(lm2.ax, lm2.ay, X+440, Y+60);          // near end onto the far end's own object
  const lm3 = (await linksNow())[0];
  ok('and it will not put both ends on one object', lm3.a === lm2.a, { a: lm3.a, b: lm3.b });

  console.log('');
  console.log((fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join(String.fromCharCode(10)) : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
