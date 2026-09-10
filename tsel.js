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
  const X = cam.x + 260, Y = cam.y + 220;
  async function drag(pts, opts){
    opts = opts || {};
    const s0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), pts[0]);
    if (opts.shift) await p.keyboard.down('Shift');
    await p.mouse.move(s0.x, s0.y); await p.mouse.down({button: opts.btn||'left'});
    for (const q of pts.slice(1)){ const s = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), q); await p.mouse.move(s.x, s.y, {steps:6}); }
    await p.mouse.up({button: opts.btn||'left'});
    if (opts.shift) await p.keyboard.up('Shift');
    await p.waitForTimeout(160);
  }
  const stats = () => p.evaluate(() => window.__pg.stats());
  const sel = () => p.evaluate(() => window.__pg.selection());
  const tool = (t,br) => p.evaluate(([t,br]) => { window.__pg.setTool(t); if(br) window.__pg.setBrush(br); }, [t,br]);

  // three separate blocks in a row
  await tool('wood', 1);
  await drag([[X, Y],[X+120, Y+100]]);
  await p.evaluate(()=>window.__pg.deselect());
  await drag([[X+180, Y],[X+300, Y+100]]);
  await p.evaluate(()=>window.__pg.deselect());
  await drag([[X+360, Y],[X+480, Y+100]]);
  await p.evaluate(()=>{ window.__pg.deselect(); window.__pg.setTool('move'); });
  const all = (await stats()).filter(o=>o.pos.y<2300).map(o=>o.id);
  console.log('\n== marquee ==');
  ok('three blocks exist', all.length === 3, all);

  await drag([[X-60, Y-60],[X+540, Y+160]]);
  ok('a drag across empty space selects all three', (await sel()).length === 3, await sel());

  await p.evaluate(()=>window.__pg.deselect());
  await drag([[X-60, Y-60],[X+150, Y+160]]);
  ok('a smaller band selects only what it touches', (await sel()).length === 1, await sel());
  await drag([[X+330, Y-60],[X+540, Y+160]], { shift:true });
  ok('shift-drag adds to the selection', (await sel()).length === 2, await sel());

  console.log('\n== moving several at once ==');
  const before = (await stats()).filter(o=>o.pos.y<2300).map(o=>o.pos.x);
  await drag([[X+60, Y+50],[X+60, Y+50]]);          // click the first block (not selected) -> selects just it
  await p.evaluate(()=>window.__pg.deselect());
  await drag([[X-60, Y-60],[X+540, Y+160]]);        // select all three
  await drag([[X+60, Y+50],[X+160, Y+50]]);         // drag one of them
  const after = (await stats()).filter(o=>o.pos.y<2300).map(o=>o.pos.x);
  console.log('   x before', before, '-> after', after);
  ok('all three moved together', after.every((x,i) => Math.abs(x - before[i] - 100) < 6), {before, after});

  console.log('\n== group actions ==');
  await drag([[X+40, Y-60],[X+640, Y+160]]);
  const n3 = (await sel()).length;
  await p.evaluate(()=>window.__pg.duplicate());
  await p.waitForTimeout(300);
  ok('duplicate copies the whole group', (await stats()).filter(o=>o.pos.y<2300).length === 3 + n3, {n3, now:(await stats()).filter(o=>o.pos.y<2300).length});
  ok('and the copies are what is now selected', (await sel()).length === n3, await sel());
  await p.evaluate(()=>window.__pg.deleteSel());
  await p.waitForTimeout(300);
  ok('delete removes the whole group', (await stats()).filter(o=>o.pos.y<2300).length === 3);
  await p.evaluate(()=>window.__pg.undo());
  await p.waitForTimeout(350);
  ok('undo brings them back', (await stats()).filter(o=>o.pos.y<2300).length === 3 + n3);

  console.log('\n== rotate about the group middle ==');
  await p.evaluate(()=>window.__pg.deselect());
  await drag([[X-60, Y-60],[X+540, Y+160]]);
  const posBefore = (await stats()).filter(o=>o.pos.y<2300).slice(0,3).map(o=>o.pos.x);
  await p.evaluate(()=>window.__pg.rotate(Math.PI/2));
  await p.waitForTimeout(300);
  const posAfter = (await stats()).filter(o=>o.pos.y<2300).slice(0,3).map(o=>o.pos.x);
  ok('rotating a group moves the pieces about a shared pivot',
     JSON.stringify(posBefore) !== JSON.stringify(posAfter), {posBefore, posAfter});

  console.log('\n== number keys ==');
  await p.evaluate(()=>window.__pg.setTool('wood'));
  for (const [key, want] of [['1','move'],['2','erase'],['3','bolt'],['4','checkpoint'],['5','wood'],['6','sponge']]){
    await p.keyboard.press(key);
    await p.waitForTimeout(60);
    const t = await p.evaluate(()=>window.__pg.tool());
    ok('"' + key + '" picks ' + want, t === want, t);
  }

  console.log('\n== right-drag still pans ==');
  await p.evaluate(()=>{ window.__pg.setTool('move'); window.__pg.deselect(); });
  const c0 = await p.evaluate(()=>window.__pg.cam());
  await drag([[X+700, Y+400],[X+560, Y+300]], { btn:'right' });
  const c1 = await p.evaluate(()=>window.__pg.cam());
  ok('right-drag on empty space moves the camera', Math.abs(c1.x - c0.x) > 20 || Math.abs(c1.y - c0.y) > 20, {c0, c1});

  console.log('\n== Del takes the piece you clicked, not the whole object ==');
  // A bar of sponge painted through a block of wood: one object, two pieces.
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('wood', 1);
  await drag([[X, Y],[X+260, Y+160]]);
  await p.evaluate(()=>window.__pg.deselect());
  await tool('sponge', 1);
  await drag([[X+40, Y+60],[X+220, Y+100]]);
  await p.evaluate(()=>window.__pg.deselect());
  const twoPiece = (await stats()).filter(o => o.pieces.length === 2)[0];
  ok('wood and sponge welded into one object', !!twoPiece, (await stats()).map(o=>o.pieces));

  const clickAt = async (wx, wy) => { const s = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [wx,wy]);
    await p.mouse.click(s.x, s.y); await p.waitForTimeout(200); };
  await p.evaluate(() => window.__pg.setTool('move'));
  await clickAt(X+130, Y+80);                      // on the sponge bar
  const nBefore = (await stats()).length;
  await p.keyboard.press('Delete');
  await p.waitForTimeout(350);
  const nowStats = await stats();
  const survivor = nowStats.filter(o => o.pieces.some(q => q.indexOf('wood') === 0))[0];
  ok('the object is still there', nowStats.length === nBefore, { nBefore, now: nowStats.length });
  ok('the sponge piece is gone', !!survivor && !survivor.pieces.some(q => q.indexOf('sponge') === 0), survivor && survivor.pieces);
  ok('and the wood it was drawn through is not', !!survivor, nowStats.map(o=>o.pieces));

  console.log('\n== double-click takes the whole object ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('wood', 1);
  await drag([[X, Y],[X+260, Y+160]]);
  await p.evaluate(()=>window.__pg.deselect());
  await tool('sponge', 1);
  await drag([[X+40, Y+60],[X+220, Y+100]]);
  await p.evaluate(()=>window.__pg.deselect());
  await p.evaluate(() => window.__pg.setTool('move'));
  const n0 = (await stats()).length;
  const s2 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+130, Y+80]);
  await p.mouse.dblclick(s2.x, s2.y);
  await p.waitForTimeout(250);
  await p.keyboard.press('Delete');
  await p.waitForTimeout(350);
  const n1 = (await stats()).length;
  ok('double-click then Del removes the whole thing', n1 === n0 - 1, { n0, n1 });


  console.log('');
  console.log('== resize by the corner handles ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setStick(false); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('wood', 1);
  await drag([[X, Y],[X+200, Y+140]]);
  await p.evaluate(()=>window.__pg.setTool('move'));
  /* Find it by being the smallest thing in the world rather than by id: undo
     rebuilds objects and hands them new ones. */
  const small = async () => (await stats()).slice().sort((a,b)=>a.area-b.area)[0];
  /* Select and anchor it so it stops falling and the handles stay where they
     were read. select() takes the object, not its id, so this happens inside
     the page. */
  const grabIt = () => p.evaluate(() => {
    const os = window.__pg.objects().slice().sort((a,b)=>window.__pg.G.pgArea(a.pieces[0].poly)-window.__pg.G.pgArea(b.pieces[0].poly));
    const o = os[0];
    window.__pg.select(o);
    if (!o.forcedStatic) window.__pg.anchor();
    return o.id;
  });
  const rid = await grabIt();
  await p.waitForTimeout(300);
  const bx0 = await p.evaluate(q => window.__pg.bounds(q), rid);
  const first = await small();
  const a0 = first.area, corn0 = first.corners;
  const hFrom = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [bx0.x2+5, bx0.y2+5]);
  const hTo = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y),
    [bx0.x-5 + (bx0.x2-bx0.x+10)*1.6, bx0.y-5 + (bx0.y2-bx0.y+10)*1.6]);
  await p.mouse.move(hFrom.x, hFrom.y); await p.mouse.down();
  await p.mouse.move(hTo.x, hTo.y, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(500);
  /* Same object, same id — resizing rebuilds its geometry but does not
     replace it. Do not go looking for "the smallest thing" here: once it has
     been scaled up it is no longer the smallest. */
  const after1 = (await stats()).filter(o => o.id === rid)[0];
  const bx1 = await p.evaluate(q => window.__pg.bounds(q), rid);
  const w0 = bx0.x2-bx0.x, w1 = bx1 ? bx1.x2-bx1.x : 0;
  console.log('   width', w0.toFixed(1), '->', w1.toFixed(1), '  area', a0, '->', after1.area, '  corners', corn0, '->', after1.corners);
  ok('dragging the handle makes it bigger', w1 > w0 * 1.25, { w0, w1 });
  ok('the opposite corner stays put', !!bx1 && Math.abs(bx1.x - bx0.x) < 12 && Math.abs(bx1.y - bx0.y) < 12, { bx0, bx1 });
  ok('scaling adds no corners', after1.corners <= corn0, { before: corn0, after: after1.corners });
  ok('area grows with the square of the scale',
     Math.abs(after1.area / a0 - (w1/w0)*(w1/w0)) < 0.25 * (w1/w0)*(w1/w0),
     { areaK: after1.area/a0, wK: w1/w0 });

  await p.evaluate(()=>window.__pg.undo());
  await p.waitForTimeout(500);
  /* Undo rebuilds objects with fresh ids, so find it by where it is instead. */
  const cx0 = (bx0.x + bx0.x2)/2, cy0 = (bx0.y + bx0.y2)/2;
  const back = (await stats()).slice().sort((u,v) =>
    Math.hypot(u.pos.x-cx0, u.pos.y-cy0) - Math.hypot(v.pos.x-cx0, v.pos.y-cy0))[0];
  ok('undo puts the size back', Math.abs(back.area - a0) / a0 < 0.12, { a0, back: back.area });

  console.log('');
  console.log('== it will not let you shrink it to nothing ==');
  const rid2 = await grabIt();
  await p.waitForTimeout(250);
  const bx3 = await p.evaluate(q => window.__pg.bounds(q), rid2);
  const gFrom = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [bx3.x2+5, bx3.y2+5]);
  const gTo = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [bx3.x-4, bx3.y-4]);
  await p.mouse.move(gFrom.x, gFrom.y); await p.mouse.down();
  await p.mouse.move(gTo.x, gTo.y, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(500);
  const bx4 = await p.evaluate(q => window.__pg.bounds(q), rid2);
  ok('it stops at a usable minimum', !!bx4 && (bx4.x2-bx4.x) >= 10, bx4 && (bx4.x2-bx4.x));

  console.log('');
  console.log('== a bolt stays on what it was pinned to ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setStick(false); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('wood', 1);
  /* A bolt goes through the layers: a backboard on Back, a plate on Mid
     lying over it, and the bolt through the plate into the board. */
  await p.evaluate(() => { window.__pg.paused(true); window.__pg.setLayer(0); });
  await drag([[X, Y],[X+100, Y+100]]);
  await p.evaluate(()=>{ window.__pg.deselect(); window.__pg.setLayer(1); });
  await drag([[X+20, Y+20],[X+140, Y+120]]);
  await p.evaluate(()=>window.__pg.deselect());
  await p.waitForTimeout(250);
  // Hold the plate still, then bolt where the two overlap.
  await p.evaluate(() => window.__pg.objects().forEach(o => {
    if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); }
  }));
  await p.evaluate(()=>window.__pg.deselect());
  await p.waitForTimeout(250);
  const pair = (await stats()).filter(o=>o.pos.y < 2340);
  ok('two objects on different layers to bolt', pair.length === 2 && new Set(pair.map(o=>o.layer)).size === 2, pair.map(o=>[o.id,o.layer]));
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('bolt'); });
  const nBolts = await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+60, Y+60]);
  ok('a bolt got placed', nBolts === 1, nBolts);
  const b0 = (await p.evaluate(()=>window.__pg.bolts()))[0];

  const leftId = pair.filter(o=>o.layer===1)[0].id;
  // Handles only exist under the move tool, and painting left it on wood.
  await p.evaluate(()=>window.__pg.setTool('move'));
  await p.evaluate(q => { const o = window.__pg.objects().find(z=>z.id===q); window.__pg.select(o); }, leftId);
  await p.waitForTimeout(200);
  const lb = await p.evaluate(q => window.__pg.bounds(q), leftId);
  const f1 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [lb.x2+5, lb.y2+5]);
  const t1 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y),
    [lb.x-5 + (lb.x2-lb.x+10)*1.5, lb.y-5 + (lb.y2-lb.y+10)*1.5]);
  await p.mouse.move(f1.x, f1.y); await p.mouse.down();
  await p.mouse.move(t1.x, t1.y, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(600);
  const b1 = (await p.evaluate(()=>window.__pg.bolts()))[0];
  const lb2 = await p.evaluate(q => window.__pg.bounds(q), leftId);
  console.log('   bolt', JSON.stringify(b0), '->', JSON.stringify(b1));
  ok('the bolt survives the resize', !!b1, b1);
  /* Only one end was resized, so the bolt holds its place in the world and
     the object grows around it — that keeps the joint valid on both bodies,
     which a bolt that jumped would not. */
  ok('and is still on the object it was pinned to',
     !!b1 && !!lb2 && b1.x >= lb2.x - 8 && b1.x <= lb2.x2 + 8 && b1.y >= lb2.y - 8 && b1.y <= lb2.y2 + 8,
     { bolt: b1, box: lb2 });
  await p.evaluate(() => window.__pg.paused(false));

  console.log('');
  console.log('== detach makes the piece its own object ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('wood', 1);
  await drag([[X, Y],[X+260, Y+160]]);
  await p.evaluate(()=>window.__pg.deselect());
  await tool('sponge', 1);
  await drag([[X+40, Y+60],[X+220, Y+100]]);
  await p.evaluate(()=>window.__pg.deselect());
  const welded = (await stats()).filter(o => o.pieces.length === 2)[0];
  ok('wood and sponge are one object to start', !!welded, (await stats()).map(o=>o.pieces));
  const nStart = (await stats()).length;
  await p.evaluate(() => window.__pg.setTool('move'));
  const sp = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+130, Y+80]);
  await p.mouse.click(sp.x, sp.y); await p.waitForTimeout(250);      // on the sponge
  await p.evaluate(() => window.__pg.detachRegion());
  await p.waitForTimeout(450);
  const now = await stats();
  const woodOnly = now.filter(o => o.pieces.length === 1 && o.pieces[0].indexOf('wood') === 0);
  const spongeOnly = now.filter(o => o.pieces.length === 1 && o.pieces[0].indexOf('sponge') === 0);
  console.log('   ', JSON.stringify(now.map(o=>o.pieces)));
  ok('there is one more object than before', now.length === nStart + 1, { nStart, now: now.length });
  ok('the sponge is now its own object', spongeOnly.length === 1, spongeOnly.map(o=>o.pieces));
  ok('the wood is still there, without the sponge', woodOnly.length >= 1 && !now.some(o => o.pieces.length === 2), now.map(o=>o.pieces));
  ok('the sponge sits where it was, in the socket it left',
     spongeOnly.length === 1 && Math.abs(spongeOnly[0].pos.x - (X+130)) < 30, spongeOnly[0] && spongeOnly[0].pos);
  ok('and it is what is selected now',
     JSON.stringify(await sel()) === JSON.stringify(spongeOnly.map(o=>o.id)), { sel: await sel(), sponge: spongeOnly.map(o=>o.id) });
  await p.evaluate(()=>window.__pg.undo());
  await p.waitForTimeout(450);
  ok('undo glues it back', (await stats()).some(o => o.pieces.length === 2), (await stats()).map(o=>o.pieces));

  console.log('');
  console.log((fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join(String.fromCharCode(10)) : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
