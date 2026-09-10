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

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join('\n') : 'none');
  await b.close();
})();
