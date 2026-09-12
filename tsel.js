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
  for (const [key, want] of [['1','move'],['2','erase'],['3','vacuum'],['4','vacuum'],['9','vacuum']]){   // only the editing tools have numbers; the rest leave the tool alone
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
  console.log('== the marquee picks by the material inside it, not the box round the object ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setStick(true); window.__pg.setPaintMode('brush'); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('wood', 2);
  await drag([[X, Y+300],[X+400, Y]]);                                  // a long diagonal plank: its box covers the whole area
  await p.evaluate(() => { window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await tool('sponge', 1);
  await drag([[X+40, Y+40],[X+70, Y+70]]);                              // two small dots up in the plank's box, well clear of its material
  await drag([[X+100, Y+40],[X+130, Y+70]]);
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  await drag([[X+20, Y+20],[X+150, Y+90]]);                             // rubber-band round the two dots only
  const picked = await p.evaluate(() => window.__pg.selected() ? window.__pg.selection().map(id => window.__pg.objects().find(o => o.id === id).pieces[0].m) : []);
  ok('a rubber band round two dots inside the plank box picks the dots and not the plank', picked.length === 2 && picked.every(m => m.indexOf('sponge') === 0), picked);
  await p.evaluate(() => window.__pg.deselect());
  await drag([[X+180, Y+60],[X+260, Y+130]]);                           // a band across the plank's material itself
  const picked2 = await p.evaluate(() => window.__pg.selected() ? window.__pg.selection().map(id => window.__pg.objects().find(o => o.id === id).pieces[0].m) : []);
  ok('and a band across the plank own material picks the plank', picked2.length === 1 && picked2[0].indexOf('wood') === 0, picked2);

  console.log('');
  console.log('== the transforms as keys: turn, flip, layer ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('wood', 1);
  await drag([[X, Y],[X+200, Y+60]]);
  await tool('sponge', 1);
  await drag([[X+300, Y],[X+340, Y+40]]);            // a second object, unselected, that the keys must leave alone
  await p.evaluate(()=>window.__pg.deselect());
  const plank = () => stats().then(st => st.filter(o => o.pieces[0].indexOf('wood') === 0)[0]);
  const lump = () => stats().then(st => st.filter(o => o.pieces[0].indexOf('sponge') === 0)[0]);
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.select(window.__pg.objects().find(o => o.pieces[0].m.indexOf('wood') === 0)); });
  const ang0 = (await plank()).angle;
  await p.keyboard.press('x'); await p.waitForTimeout(150);
  ok('X turns the selection right 15°', Math.abs((await plank()).angle - ang0 - Math.PI/12) < 0.02, (await plank()).angle);
  await p.keyboard.press('z'); await p.keyboard.press('z'); await p.waitForTimeout(150);
  ok('Z turns it left', Math.abs((await plank()).angle - ang0 + Math.PI/12) < 0.02, (await plank()).angle);
  ok('and the unselected sponge did not turn', Math.abs((await lump()).angle) < 0.01, (await lump()).angle);
  await p.keyboard.press('z'); await p.waitForTimeout(150);   // back to level, so a flip is measurable
  const bb0 = (await plank()).bounds;
  await p.evaluate(() => { const o = window.__pg.objects().find(o => o.pieces[0].m.indexOf('wood') === 0); window.__pg.select(o); });
  await p.keyboard.press('h'); await p.waitForTimeout(150);
  const bb1 = (await plank()).bounds;
  ok('H flips it about its own middle', Math.abs((bb0.x + bb0.x2) - (bb1.x + bb1.x2)) < 4 && Math.abs((bb1.x2 - bb1.x) - (bb0.x2 - bb0.x)) < 4, { before: bb0, after: bb1 });
  await p.keyboard.press('Shift+BracketRight'); await p.waitForTimeout(150);
  ok('Shift+] moves the selection a layer forward', (await plank()).layer === 2, (await plank()).layer);
  await p.keyboard.press('Shift+BracketLeft'); await p.keyboard.press('Shift+BracketLeft'); await p.waitForTimeout(150);
  ok('Shift+[ moves it back', (await plank()).layer === 0, (await plank()).layer);
  ok('the sponge stayed on Mid', (await lump()).layer === 1);
  await p.evaluate(()=>window.__pg.deselect());
  const ang1 = (await plank()).angle;
  await p.keyboard.press('x'); await p.waitForTimeout(150);
  ok('with nothing selected the keys do nothing', Math.abs((await plank()).angle - ang1) < 0.001);

  console.log('');
  console.log('== a dragged object with its physics on still collides ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setStick(false); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.paused(true); });
  await p.waitForTimeout(150);
  await tool('wood', 1);
  await drag([[X, Y+100],[X+900, Y+140]]);                       // a floor (its start on-screen: a drag begun off-screen loses the button)
  await p.evaluate(() => { const o = window.__pg.objects().slice(-1)[0]; window.__pg.select(o); window.__pg.anchor(); window.__pg.deselect(); });
  await drag([[X+500, Y-60],[X+540, Y+100]]);                        // a wall, locked
  await p.evaluate(() => { const o = window.__pg.objects().slice(-1)[0]; window.__pg.select(o); window.__pg.anchor(); window.__pg.deselect(); });
  await tool('sponge', 1);
  await drag([[X+200, Y+40],[X+260, Y+100]]);                             // a loose crate A
  await tool('rubber', 1);
  await drag([[X+340, Y+40],[X+400, Y+100]]);                        // a loose crate B, to its right
  await p.evaluate(() => { window.__pg.deselect(); window.__pg.setTool('move'); window.__pg.paused(false); });
  await p.waitForTimeout(400);
  const crate = (m) => stats().then(st => st.filter(o => o.pieces[0].indexOf(m) === 0)[0]);
  const wallB = (await stats()).filter(o => o.pieces[0].indexOf('wood') === 0 && o.bounds.y2 - o.bounds.y > 100)[0].bounds;
  const cA0 = await crate('sponge'), cB0 = await crate('rubber');
  // drag A rightward, into B and on toward the wall
  const q0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [cA0.pos.x, cA0.pos.y]);
  const q1 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+530, cA0.pos.y]);
  await p.mouse.move(q0.x, q0.y); await p.mouse.down();
  for (let i = 1; i <= 12; i++){ await p.mouse.move(q0.x + (q1.x - q0.x) * i / 12, q0.y, { steps: 2 }); await p.waitForTimeout(60); }
  await p.waitForTimeout(500);
  const cA1 = await crate('sponge'), cB1 = await crate('rubber');
  await p.mouse.up(); await p.waitForTimeout(200);
  ok('the loose crate it met was shoved along in front of it', cB1.pos.x > cB0.pos.x + 40, { from: cB0.pos.x, to: cB1.pos.x });
  ok('the two never overlap', cA1.bounds.x2 <= cB1.bounds.x + 3, { a: cA1.bounds, b: cB1.bounds });
  ok('and the locked wall stopped them short of the cursor', cB1.bounds.x2 <= wallB.x + 3 && cA1.pos.x < X + 500, { b: cB1.bounds, wall: wallB });
  // a locked crate goes straight through
  await p.evaluate(() => { window.__pg.paused(true); });
  const cA2 = await crate('sponge');
  await p.evaluate(id => { const o = window.__pg.objects().find(o => o.id === id); window.__pg.select(o); window.__pg.anchor(); window.__pg.deselect(); }, cA2.id);
  const r0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [cA2.pos.x, cA2.pos.y]);
  const r1 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+600, cA2.pos.y]);
  await p.mouse.move(r0.x, r0.y); await p.mouse.down(); await p.mouse.move(r1.x, r1.y, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(200);
  const cA3 = await crate('sponge');
  ok('a locked crate (physics off) goes wherever the cursor says, straight through the wall to the far side', Math.abs(cA3.pos.x - (X+600)) < 6, { x: cA3.pos.x, wanted: X+600 });
  // paused, a free crate is still stopped by hand
  await p.evaluate(id => { const o = window.__pg.objects().find(o => o.id === id); window.__pg.select(o); window.__pg.anchor(); window.__pg.deselect(); }, cA3.id);   // free again
  const cA4 = await crate('sponge');
  ok('(the crate is free again)', cA4.static === false);
  const v0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [cA4.pos.x, cA4.pos.y]);
  const v1 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+300, cA4.pos.y]);
  await p.mouse.move(v0.x, v0.y); await p.mouse.down(); await p.mouse.move(v1.x, v1.y, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(200);
  const cA5 = await crate('sponge');
  ok('paused, dragging a free crate back through the wall stops it at the wall', cA5.bounds.x >= wallB.x2 - 3 && cA5.pos.x > X + 500, { crate: cA5.bounds, wall: wallB });

  console.log('');
  console.log('\n== glue: same layer welds into one; different layers stay put and move as one ==');
  await p.mouse.move(640, 400); await p.waitForTimeout(150);
  await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.deselect(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); window.__pg.setTool('move'); });
  await p.waitForTimeout(400);
  const GX = X + 160;   // the scene sits to the right, on screen: a drag must never start off it
  const w2p = (x,y) => p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [x,y]);
  const gRect = async (mat, layer, x0, y0, x1, y1) => {
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); window.__pg.setPaintMode('rect'); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up(); await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  };
  const gNs = await p.evaluate(() => window.__pg.objects().length);
  await gRect('wood', 0, GX-200, Y-100, GX+200, Y-40);     // a Back beam
  await gRect('metal', 1, GX-40, Y-30, GX+40, Y+50);      // a Mid gCrate, in front of it
  await gRect('sponge', 1, GX+260, Y-30, GX+340, Y+50);   // another Mid thing, well apart from the gCrate
  const gIds = await p.evaluate(n => window.__pg.objects().slice(n).map(o => ({ id: o.id, m: o.pieces[0].m, layer: o.layer })), gNs);
  const gBack = gIds.filter(o => o.m === 'wood')[0], gCrate = gIds.filter(o => o.m === 'metal')[0], gSpg = gIds.filter(o => o.m === 'sponge')[0];
  ok('three things: a Back beam and two Mid things', gBack && gBack.layer === 0 && gCrate && gCrate.layer === 1 && gSpg && gSpg.layer === 1, gIds);
  // unlock the gCrate so it could move, then glue it to the beam behind
  await p.evaluate(id => { const o = window.__pg.objects().filter(o => o.id === id)[0]; window.__pg.select(o); window.__pg.anchor(); window.__pg.deselect(); }, gCrate.id);
  ok('the gCrate is free gBefore the glue', !(await p.evaluate(id => window.__pg.glueOf(id), gCrate.id)).isStatic);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('glue'); });
  ok('the first glue click picks the gCrate up', (await p.evaluate(([x,y]) => window.__pg.glueAt(x,y), [GX, Y+10])) === gCrate.id);
  await p.evaluate(() => window.__pg.setLayer(0));
  await p.evaluate(([x,y]) => window.__pg.glueAt(x,y), [GX-150, Y-70]);   // on the beam, where the gCrate does not cover it
  const gb = await p.evaluate(id => window.__pg.glueOf(id), gBack.id), gc = await p.evaluate(id => window.__pg.glueOf(id), gCrate.id);
  ok('glued across layers: both keep their layers', gb.layer === 0 && gc.layer === 1 && (await p.evaluate(() => window.__pg.objects().length)) === 4, { gb, gc });
  ok('and share a glue group', gb.glue && gb.glue === gc.glue && gb.mates.length === 2, { gb, gc });
  ok('the Mid gCrate is held still by the scenery it is glued to', gc.held === true && gc.isStatic === true, gc);
  ok('selecting one selects both', await p.evaluate(id => { const o = window.__pg.objects().filter(o => o.id === id)[0]; window.__pg.select(o); return window.__pg.selIds().length === 2; }, gCrate.id));
  // drag the gCrate: the beam comes along
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  const gBefore = await p.evaluate(gIds => gIds.map(id => { const o = window.__pg.objects().filter(o => o.id === id)[0]; return [o.body.position.x, o.body.position.y]; }), [gBack.id, gCrate.id]);
  const d0 = await w2p(GX, Y+10), d1 = await w2p(GX+120, Y+10);
  await p.mouse.move(d0.x, d0.y); await p.mouse.down(); await p.mouse.move(d1.x, d1.y, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(200);
  const gAfter = await p.evaluate(gIds => gIds.map(id => { const o = window.__pg.objects().filter(o => o.id === id)[0]; return [o.body.position.x, o.body.position.y]; }), [gBack.id, gCrate.id]);
  ok('dragging the gCrate moves the beam behind it too, by the same amount', gAfter[1][0] - gBefore[1][0] > 90 && Math.abs((gAfter[0][0] - gBefore[0][0]) - (gAfter[1][0] - gBefore[1][0])) < 3, { gBefore, gAfter });
  // the sponge, not glued, stayed
  ok('the other Mid thing was not part of it', Math.abs((await p.evaluate(id => window.__pg.objects().filter(o => o.id === id)[0].body.position.x, gSpg.id)) - (GX+300)) < 8);
  // save and load keep the group
  const gData = await p.evaluate(() => window.__pg.serialize('glue'));
  ok('the level file carries the glue', gData.objects.filter(o => o.glue).length === 2 && gData.objects.filter(o => o.glue)[0].glue === gData.objects.filter(o => o.glue)[1].glue);
  await p.evaluate(d => window.__pg.load(d), gData); await p.waitForTimeout(200);
  const gLoaded = await p.evaluate(() => window.__pg.objects().filter(o => o.glue).map(o => ({ layer: o.layer, held: window.__pg.glueOf(o.id).held })));
  ok('gLoaded, they are still glued, the Mid one still held', gLoaded.length === 2 && gLoaded.some(o => o.layer === 1 && o.held), gLoaded);
  // unglue frees the gCrate
  const crate2 = await p.evaluate(() => window.__pg.objects().filter(o => o.glue && o.layer === 1)[0].id);
  await p.evaluate(id => window.__pg.unglue(id), crate2);
  const gc2 = await p.evaluate(id => window.__pg.glueOf(id), crate2);
  ok('unglued, the gCrate is free again and alone', gc2.glue === null && gc2.held === false && gc2.isStatic === false && (await p.evaluate(() => window.__pg.objects().filter(o => o.glue).length)) === 0, gc2);
  // same layer: welded into one, as gBefore
  const gN0w = await p.evaluate(() => window.__pg.objects().length);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('glue'); });
  const cr2 = await p.evaluate(id => { const o = window.__pg.objects().filter(o => o.id === id)[0]; return { x: o.body.position.x, y: o.body.position.y }; }, crate2);
  await p.evaluate(([x,y]) => window.__pg.glueAt(x,y), [cr2.x, cr2.y]);                 // the crate first
  await p.evaluate(([x,y]) => window.__pg.glueAt(x,y), [GX+300, Y+10]);                // then the sponge
  ok('two Mid things glued become one object', (await p.evaluate(() => window.__pg.objects().length)) === gN0w - 1 && (await p.evaluate(() => window.__pg.objects().some(o => o.pieces.length === 2))), { n: await p.evaluate(() => window.__pg.objects().length), gN0w, objs: await p.evaluate(() => window.__pg.objects().map(o => [o.id, o.pieces.map(pc => pc.m), o.layer, Math.round(o.body.position.x), Math.round(o.body.position.y)])), toast: await p.evaluate(() => document.getElementById('toast').textContent), cr2, GX, Y });
  await p.keyboard.press('Escape');
  // a mover on the Mid thing carries the Back thing glued to it
  await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.deselect(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); window.__pg.setTool('move'); });
  await p.waitForTimeout(300);
  await gRect('wood', 0, GX-50, Y-100, GX+350, Y-40);
  await gRect('metal', 1, GX+110, Y-30, GX+190, Y+50);
  const mvBack = await p.evaluate(() => window.__pg.objects().filter(o => o.layer === 0)[0].id), mvCrate = await p.evaluate(() => window.__pg.objects().filter(o => o.pieces[0].m === 'metal')[0].id);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('glue'); });
  await p.evaluate(([x,y]) => window.__pg.glueAt(x,y), [GX+150, Y+10]);
  await p.evaluate(() => window.__pg.setLayer(0));
  await p.evaluate(([x,y]) => window.__pg.glueAt(x,y), [GX, Y-70]);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('mover'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [GX+150, Y+10]);
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [GX+350, Y+10]);   // 200 to the right
  await p.evaluate(() => { const g = window.__pg.gadgets().filter(g => g.kind === 'mover')[0]; window.__pg.gadgetSet(g.id, { speed: 400 }); window.__pg.setTool('move'); });
  const mv0 = await p.evaluate(ids => ids.map(id => { const o = window.__pg.objects().filter(o => o.id === id)[0]; return o.body.position.x; }), [mvBack, mvCrate]);
  await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(900);
  const mv1 = await p.evaluate(() => { const b = window.__pg.objects().filter(o => o.layer === 0)[0], c = window.__pg.objects().filter(o => o.pieces[0].m === 'metal')[0]; return [b.body.position.x, c.body.position.x]; });
  ok('a mover on the Mid thing carries the Back thing glued to it, by the same amount', mv1[1] - mv0[1] > 150 && Math.abs((mv1[0] - mv0[0]) - (mv1[1] - mv0[1])) < 4, { mv0, mv1 });
  await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await p.waitForTimeout(200);
  ok('Esc puts the glue down', (await p.evaluate(() => window.__pg.tool ? window.__pg.tool() : null)) !== 'glue' && !(await p.evaluate(() => document.getElementById('game').classList.contains('glueMode'))));

  console.log((fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join(String.fromCharCode(10)) : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
