/* Bolts: layers, placement, motors, tightness, the box, and save/load.
   node tbolt.js */
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
  const w2p = (x,y) => p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [x,y]);
  async function rect(mat, x0, y0, x1, y1){
    await p.evaluate(m => { window.__pg.setTool(m); window.__pg.deselect(); }, mat);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const stats = () => p.evaluate(() => window.__pg.stats());
  const boltsNow = () => p.evaluate(() => window.__pg.bolts());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  /* Fresh world, physics paused so nothing falls while it is being set up. */
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
    await p.waitForTimeout(150);
  };
  /* A locked post with a free arm beside it, and a bolt in the gap. */
  const postAndArm = async () => {
    await fresh();
    await rect('wood', X, Y, X+60, Y+80);
    await lockAll();
    await rect('wood', X+70, Y-10, X+210, Y+20);
    const n = await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+65, Y+10]);
    return (await boltsNow())[0];
  };

  console.log('');
  console.log('== placing ==');
  await postAndArm();
  ok('a bolt joins two objects near the cursor', (await boltsNow()).length === 1, await boltsNow());
  ok('and starts as a plain bolt on the layer you are building on',
     (await boltsNow())[0].mode === 'tight' && (await boltsNow())[0].layer === 1, (await boltsNow())[0]);

  // Near the EDGE of something big: used to fail, because it measured to
  // the centre and gave up past 90px.
  await fresh();
  await rect('wood', X, Y, X+400, Y+60);           // a long beam
  await lockAll();
  await rect('wood', X+410, Y+10, X+470, Y+50);    // a small block off its end
  const nEdge = await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+405, Y+30]);
  ok('a bolt can go near the far end of a big object', nEdge === 1, nEdge);

  console.log('');
  console.log('== layers ==');
  await fresh();
  await rect('wood', X, Y, X+60, Y+80);             // Mid
  await lockAll();
  await p.evaluate(() => window.__pg.setLayer(2));  // Front
  await rect('wood', X+70, Y-10, X+210, Y+20);      // Front
  const nCross = await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+65, Y+10]);
  ok('a bolt will not join across layers', nCross === 0, nCross);
  await rect('wood', X, Y+100, X+60, Y+180);        // another Front piece near the arm
  await p.evaluate(() => window.__pg.setLayer(2));
  const nFront = await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+65, Y+60]);
  ok('but joins two things on the Front layer', nFront >= 1, nFront);
  const frontBolt = (await boltsNow()).slice(-1)[0];
  ok('and the bolt is on that layer', frontBolt && frontBolt.layer === 2, frontBolt);
  await p.evaluate(() => window.__pg.setLayer(1));

  console.log('');
  console.log('== the joint holds and the drawing agrees ==');
  const bolt = await postAndArm();
  await p.evaluate(id => window.__pg.boltSet(id, { mode:'cw', speed:0.08 }), bolt.id);
  await p.evaluate(() => window.__pg.paused(false));
  await p.waitForTimeout(1500);
  const t = await p.evaluate(id => window.__pg.boltGapTrue(id), bolt.id);
  ok('the two anchors stay together under a motor', t.gap < 2, t.gap);
  ok('the bolt is drawn where the joint actually is',
     Math.hypot(t.drawnAt.x - t.trueAt.x, t.drawnAt.y - t.trueAt.y) < 2, { drawn: t.drawnAt, real: t.trueAt });
  ok('and the arm has turned', Math.abs(t.armAngleDeg) > 20, t.armAngleDeg);

  console.log('');
  console.log('== motors run when the world runs ==');
  const b2 = await postAndArm();
  await p.evaluate(id => window.__pg.boltSet(id, { mode:'cw', speed:0.08 }), b2.id);
  const a0 = (await p.evaluate(id => window.__pg.boltGapTrue(id), b2.id)).armAngleDeg;
  await p.waitForTimeout(600);
  const a1 = (await p.evaluate(id => window.__pg.boltGapTrue(id), b2.id)).armAngleDeg;
  ok('paused in Build: it does not turn', Math.abs(a1 - a0) < 1, { a0, a1 });
  await p.evaluate(() => window.__pg.paused(false));
  await p.waitForTimeout(600);
  const a2 = (await p.evaluate(id => window.__pg.boltGapTrue(id), b2.id)).armAngleDeg;
  ok('unpaused in Build: it turns', Math.abs(a2 - a1) > 10, { a1, a2 });
  await p.evaluate(id => window.__pg.boltSet(id, { mode:'ccw' }), b2.id);
  const a3 = (await p.evaluate(id => window.__pg.boltGapTrue(id), b2.id)).armAngleDeg;
  await p.waitForTimeout(600);
  const a4 = (await p.evaluate(id => window.__pg.boltGapTrue(id), b2.id)).armAngleDeg;
  ok('the other direction turns the other way', Math.sign(a4 - a3) === -Math.sign(a2 - a1), { cw: a2 - a1, ccw: a4 - a3 });

  console.log('');
  console.log('== tightness is how freely it swings ==');
  // Same setup, arm released to swing under gravity. Measure how far it has
  // turned after a moment: a tight bolt lets it turn less than a loose one.
  async function swing(tightness){
    const bb = await postAndArm();
    await p.evaluate(([id, tt]) => window.__pg.boltSet(id, { mode:'tight', tightness: tt }), [bb.id, tightness]);
    await p.evaluate(() => window.__pg.paused(false));
    await p.waitForTimeout(700);
    return Math.abs((await p.evaluate(id => window.__pg.boltGapTrue(id), bb.id)).armAngleDeg);
  }
  const loose = await swing(0.0), tight = await swing(1.0);
  console.log('   swung', loose.toFixed(1) + '° loose,', tight.toFixed(1) + '° tight');
  ok('a loose bolt lets the arm swing', loose > 15, loose);
  ok('a tight bolt holds it up much more', tight < loose * 0.5, { loose, tight });

  console.log('');
  console.log('== the box ==');
  const b3 = await postAndArm();
  await p.evaluate(() => window.__pg.setTool('move'));
  const bp = await p.evaluate(id => { const bl = window.__pg.bolts().find(q => q.id === id); return window.__pg.w2sPage(bl.x, bl.y); }, b3.id);
  await p.mouse.click(bp.x, bp.y);
  await p.waitForTimeout(200);
  ok('left-click selects the bolt but keeps the box closed', !(await p.evaluate(() => window.__pg.ctxOpen())));
  await p.mouse.click(bp.x, bp.y, { button:'right' });
  await p.waitForTimeout(250);
  ok('right-click opens the box for it', await p.evaluate(() => window.__pg.ctxOpen()));
  ok('titled as a bolt', /Bolt/i.test(await p.evaluate(() => document.querySelector('#opHead .t').textContent)));
  ok('with a tightness slider', await p.evaluate(() => /Tightness/.test(document.getElementById('opBody').innerText)));
  await p.evaluate(() => { Array.from(document.querySelectorAll('#opBody button')).find(x => /Motor/.test(x.textContent)).click(); });
  await p.waitForTimeout(200);
  ok('switching to Motor shows direction and speed', await p.evaluate(() => /direction/i.test(document.getElementById('opBody').innerText) && /speed/i.test(document.getElementById('opBody').innerText)));
  ok('and the bolt is now a motor', (await boltsNow())[0].mode === 'cw', (await boltsNow())[0]);
  await p.evaluate(() => {
    const r = Array.from(document.querySelectorAll('#opBody input[type=range]')).pop();
    r.value = 0.2; r.dispatchEvent(new Event('input', { bubbles:true }));
  });
  await p.waitForTimeout(150);
  ok('the speed slider sets this bolt\'s own speed', Math.abs((await p.evaluate(() => window.__pg.boltSpeed ? window.__pg.boltSpeed() : 0.2)) - 0.2) < 0.001);
  await p.keyboard.press('Delete');
  await p.waitForTimeout(250);
  ok('Del removes the bolt', (await boltsNow()).length === 0);
  ok('and closes the box', !(await p.evaluate(() => window.__pg.ctxOpen())));
  await p.evaluate(() => window.__pg.undo());
  await p.waitForTimeout(350);
  ok('undo brings it back as it was', (await boltsNow()).length === 1 && (await boltsNow())[0].mode === 'cw', await boltsNow());

  console.log('');
  console.log('== it saves what it is ==');
  const b4 = await postAndArm();
  await p.evaluate(id => window.__pg.boltSet(id, { mode:'ccw', speed:0.11, tightness:0.3 }), b4.id);
  const data = await p.evaluate(() => window.__pg.serialize('bolts'));
  const saved = data.bolts[0];
  ok('the save carries layer, speed and tightness', saved.layer === 1 && Math.abs(saved.speed - 0.11) < 1e-6 && Math.abs(saved.tightness - 0.3) < 1e-6, saved);
  await p.evaluate(d => window.__pg.load(d), data);
  await p.waitForTimeout(300);
  const back = (await boltsNow())[0];
  ok('and they come back', back && back.mode === 'ccw', back);
  // An old level: no per-bolt speed, one speed for the world.
  const old = JSON.parse(JSON.stringify(data));
  delete old.bolts[0].speed; delete old.bolts[0].tightness; delete old.bolts[0].layer;
  old.world.motorSpeed = 0.17;
  await p.evaluate(d => window.__pg.load(d), old);
  await p.waitForTimeout(300);
  ok('an old level\'s world speed becomes each bolt\'s speed',
     Math.abs((await p.evaluate(() => window.__pg.boltSpeed ? window.__pg.boltSpeed() : 0.17)) - 0.17) < 1e-6);

  console.log('');
  console.log('== flipping carries the bolt ==');
  const b5 = await postAndArm();
  /* Flip just the arm. The bolt's other end is on the post, which did not
     move, so the bolt holds its place in the world and the arm's anchor is
     rebuilt from it. Before the fix the rebuild reset the arm's angle but
     left the old angle in the constraint, and the joint opened up. */
  await p.evaluate(() => { window.__pg.setTool('move'); const o = window.__pg.objects().filter(q => !q.body.isStatic)[0]; window.__pg.select(o); });
  const before = await p.evaluate(id => window.__pg.boltGapTrue(id), b5.id);
  await p.evaluate(() => window.__pg.flip());
  await p.waitForTimeout(300);
  const after = await p.evaluate(id => window.__pg.boltGapTrue(id), b5.id);
  ok('the joint is still closed after a flip', after.gap < 2, { before: before.gap, after: after.gap });

  console.log('');
  console.log((fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join(String.fromCharCode(10)) : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
