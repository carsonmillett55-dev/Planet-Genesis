/* Bolts: they go through layers, four kinds with their own settings, the
   box, the ghost, and save/load.  node tbolt.js */
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
  async function rect(mat, layer, x0, y0, x1, y1){
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const stats = () => p.evaluate(() => window.__pg.stats());
  const boltsNow = () => p.evaluate(() => window.__pg.bolts());
  const rel = (id) => p.evaluate(i => window.__pg.boltRel(i), id);
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
    await p.waitForTimeout(150);
  };
  /* A post on the BACK layer, a free arm on MID lying across it, and a bolt
     through the arm into the post — the way LBP does it. */
  const postAndArm = async (tool) => {
    await fresh();
    await rect('wood', 0, X, Y-40, X+60, Y+120);         // Back: the post
    await rect('metal', 1, X-10, Y, X+220, Y+30);        // Mid: the arm, over the post
    await p.evaluate(t => { window.__pg.setLayer(1); window.__pg.setTool(t || 'bolt'); }, tool || 'bolt');
    const n = await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+25, Y+15]);
    return (await boltsNow())[0];
  };

  console.log('');
  console.log('== a bolt goes through to the layer behind ==');
  const first = await postAndArm();
  ok('a bolt joins the arm to the post behind it', !!first, await boltsNow());
  ok('it is drawn with the front of the two', first && first.layer === 1, first);
  ok('and starts as a plain bolt', first && first.kind === 'bolt' && first.mode === 'tight', first);

  await fresh();
  await rect('wood', 1, X, Y, X+60, Y+80);
  await rect('wood', 1, X+70, Y-10, X+210, Y+20);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('bolt'); });
  const nSame = await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+65, Y+10]);
  ok('two things side by side on the same layer cannot be bolted', nSame === 0, nSame);

  await fresh();
  await rect('wood', 1, X, Y, X+200, Y+60);             // Mid
  await rect('wood', 2, X+40, Y-30, X+120, Y+90);       // Front, over it
  await p.evaluate(() => { window.__pg.setLayer(2); window.__pg.setTool('bolt'); });
  const nFront = await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+80, Y+30]);
  const fb = (await boltsNow())[0];
  ok('from the Front layer it goes through to Mid', nFront === 1 && !!fb, fb);
  ok('and is drawn with the Front layer', fb && fb.layer === 2, fb);
  await p.evaluate(() => window.__pg.setLayer(1));

  console.log('');
  console.log('== the ghost knows before you click ==');
  await postAndArm();
  await p.evaluate(() => { window.__pg.setLayer(1); });
  const pairYes = await p.evaluate(([x,y]) => window.__pg.boltPairAt(x,y), [X+25, Y+15]);
  const pairNo = await p.evaluate(([x,y]) => window.__pg.boltPairAt(x,y), [X+150, Y+15]);
  ok('over the arm-on-post it has a pair', !!pairYes, pairYes);
  ok('over the arm alone it has none', !pairNo, pairNo);

  console.log('');
  console.log('== the joint holds and the drawing agrees ==');
  const bolt = await postAndArm('motorbolt');
  ok('the motor bolt tool makes a motor bolt', bolt.kind === 'motor', bolt);
  await p.evaluate(id => window.__pg.boltSet(id, { speed:0.08 }), bolt.id);
  await p.evaluate(() => window.__pg.paused(false));
  await p.waitForTimeout(1500);
  const t = await p.evaluate(id => window.__pg.boltGapTrue(id), bolt.id);
  ok('the two anchors stay together under a motor', t.gap < 2, t.gap);
  ok('the bolt is drawn where the joint actually is',
     Math.hypot(t.drawnAt.x - t.trueAt.x, t.drawnAt.y - t.trueAt.y) < 2, { drawn: t.drawnAt, real: t.trueAt });
  ok('and the arm has turned', Math.abs(await rel(bolt.id)) > 20, await rel(bolt.id));

  console.log('');
  console.log('== motors run when the world runs ==');
  const b2 = await postAndArm('motorbolt');
  await p.evaluate(id => window.__pg.boltSet(id, { speed:0.08 }), b2.id);
  const a0 = await rel(b2.id);
  await p.waitForTimeout(600);
  const a1 = await rel(b2.id);
  ok('paused in Build: it does not turn', Math.abs(a1 - a0) < 1, { a0, a1 });
  await p.evaluate(() => window.__pg.paused(false));
  await p.waitForTimeout(600);
  const a2 = await rel(b2.id);
  ok('unpaused in Build: it turns', Math.abs(a2 - a1) > 10, { a1, a2 });
  await p.evaluate(id => window.__pg.boltSet(id, { dir:-1 }), b2.id);
  const a3 = await rel(b2.id);
  await p.waitForTimeout(600);
  const a4 = await rel(b2.id);
  const wrap = (d) => ((d + 540) % 360) - 180;
  ok('the other direction turns the other way', Math.sign(wrap(a4 - a3)) === -Math.sign(wrap(a2 - a1)), { cw: wrap(a2 - a1), ccw: wrap(a4 - a3) });

  console.log('');
  console.log('== tightness is how freely it swings ==');
  async function swing(tightness){
    const bb = await postAndArm('bolt');
    await p.evaluate(([id, tt]) => window.__pg.boltSet(id, { tightness: tt }), [bb.id, tightness]);
    await p.evaluate(() => window.__pg.paused(false));
    await p.waitForTimeout(700);
    return Math.abs(await rel(bb.id));
  }
  const loose = await swing(0.0), tight = await swing(1.0);
  console.log('   swung', loose.toFixed(1) + '° loose,', tight.toFixed(1) + '° tight');
  ok('a loose bolt lets the arm swing', loose > 15, loose);
  ok('a tight bolt holds it up much more', tight < loose * 0.5, { loose, tight });

  console.log('');
  console.log('== a sprung bolt comes back ==');
  const sb = await postAndArm('sprungbolt');
  ok('the sprung bolt tool makes one', sb.kind === 'sprung', sb);
  /* Strength is the spring. With none, the arm hangs like it would on a
     loose bolt; with all of it, the spring holds the arm up near where it
     was placed. */
  async function sprung(strength){
    const bb = await postAndArm('sprungbolt');
    await p.evaluate(([id, st]) => window.__pg.boltSet(id, { strength: st, tightness: 0.2 }), [bb.id, strength]);
    await p.evaluate(() => window.__pg.paused(false));
    await p.waitForTimeout(1800);
    return Math.abs(await rel(bb.id));
  }
  const weak = await sprung(0), strong = await sprung(1);
  console.log('   settled at', weak.toFixed(1) + '° with no spring,', strong.toFixed(1) + '° at full strength');
  ok('with no spring the arm hangs down', weak > 15, weak);
  ok('at full strength the spring holds it near where it was placed', strong < 6, strong);

  console.log('');
  console.log('== a wobble bolt goes there and back ==');
  const wb = await postAndArm('wobblebolt');
  ok('the wobble bolt tool makes one', wb.kind === 'wobble', wb);
  await p.evaluate(id => window.__pg.boltSet(id, { angle: 40, period: 1.2 }), wb.id);
  await p.evaluate(() => window.__pg.paused(false));
  const samples = [];
  for (let i = 0; i < 8; i++){ await p.waitForTimeout(150); samples.push(await rel(wb.id)); }
  const mx = Math.max(...samples), mn = Math.min(...samples);
  console.log('   angles', samples.map(v => v.toFixed(0)).join(' '));
  ok('it swings one way', mx > 15, mx);
  ok('and the other', mn < -15, mn);
  ok('within the angle it was given', mx < 50 && mn > -50, { mx, mn });

  console.log('');
  console.log('== a fresh motor is not frantic ==');
  const gm = await postAndArm('motorbolt');
  ok('the default is a lazy 11 rpm or so', gm.speed > 0.015 && gm.speed < 0.03, gm.speed);

  console.log('');
  console.log('== angle limits are a hard stop ==');
  const lb = await postAndArm('bolt');
  await p.evaluate(id => window.__pg.boltSet(id, { tightness: 0, limit: true, minA: -25, maxA: 25 }), lb.id);
  await p.evaluate(() => window.__pg.paused(false));
  await p.waitForTimeout(1200);
  const lim = await rel(lb.id);
  ok('the arm drops to the limit and no further', Math.abs(lim) > 15 && Math.abs(lim) < 32, lim);
  const lb2 = await postAndArm('bolt');
  await p.evaluate(id => window.__pg.boltSet(id, { tightness: 0, limit: false }), lb2.id);
  await p.evaluate(() => window.__pg.paused(false));
  await p.waitForTimeout(1200);
  const free = await rel(lb2.id);
  ok('without limits the same arm swings well past it', Math.abs(free) > 33, free);

  console.log('');
  console.log('== visible in play is remembered ==');
  const vb = await postAndArm('bolt');
  await p.evaluate(id => window.__pg.boltSet(id, { visible: false, limit: true, minA: -40, maxA: 60 }), vb.id);
  const vd = await p.evaluate(() => window.__pg.serialize('v'));
  ok('the save carries visibility and the limits', vd.bolts[0].visible === false && vd.bolts[0].limit === true && vd.bolts[0].minA === -40 && vd.bolts[0].maxA === 60, vd.bolts[0]);
  await p.evaluate(d => window.__pg.load(d), vd);
  await p.waitForTimeout(300);
  const vb2 = (await boltsNow())[0];
  ok('and they come back', vb2.visible === false && vb2.limit === true && vb2.minA === -40 && vb2.maxA === 60, vb2);

  console.log('');
  console.log('== the box ==');
  const b3 = await postAndArm('bolt');
  await p.evaluate(() => window.__pg.setTool('move'));
  const bp = await p.evaluate(id => { const bl = window.__pg.bolts().find(q => q.id === id); return window.__pg.w2sPage(bl.x, bl.y); }, b3.id);
  await p.mouse.click(bp.x, bp.y);
  await p.waitForTimeout(200);
  ok('left-click selects the bolt but keeps the box closed', !(await p.evaluate(() => window.__pg.ctxOpen())));
  await p.mouse.click(bp.x, bp.y, { button:'right' });
  await p.waitForTimeout(250);
  ok('right-click opens the box for it', await p.evaluate(() => window.__pg.ctxOpen()));
  ok('titled as a bolt', /^Bolt$/i.test(await p.evaluate(() => document.querySelector('#opHead .t').textContent)), await p.evaluate(() => document.querySelector('#opHead .t').textContent));
  ok('with all four kinds to pick from', await p.evaluate(() => Array.from(document.querySelectorAll('#opBody button')).filter(x => /bolt/i.test(x.textContent) && !/remove/i.test(x.textContent)).length) === 4);
  ok('with a tightness slider', await p.evaluate(() => /tightness/i.test(document.getElementById('opBody').innerText)));
  await p.evaluate(() => { Array.from(document.querySelectorAll('#opBody button')).find(x => /Motor bolt/.test(x.textContent)).click(); });
  await p.waitForTimeout(200);
  ok('switching to Motor shows direction and speed', await p.evaluate(() => /direction/i.test(document.getElementById('opBody').innerText) && /speed/i.test(document.getElementById('opBody').innerText)));
  ok('and the bolt is now a motor', (await boltsNow())[0].kind === 'motor', (await boltsNow())[0]);
  await p.evaluate(() => {
    const r = Array.from(document.querySelectorAll('#opBody input[type=range]')).pop();
    r.value = 0.1; r.dispatchEvent(new Event('input', { bubbles:true }));
  });
  await p.waitForTimeout(150);
  ok('the speed slider sets this bolt\'s own speed', Math.abs((await boltsNow())[0].speed - 0.1) < 0.001, (await boltsNow())[0].speed);
  // typing into the value field speaks the units on show: rpm here
  await p.evaluate(() => { const rows = Array.from(document.querySelectorAll('#opBody .settingRow')); rows.find(r => /Speed/.test(r.querySelector('label').textContent)).querySelector('input.val').focus(); });
  await p.waitForTimeout(50);
  await p.keyboard.press('Control+a'); await p.keyboard.type('20'); await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  const rpmNow = await p.evaluate(() => { const rows = Array.from(document.querySelectorAll('#opBody .settingRow')); return rows.find(r => /Speed/.test(r.querySelector('label').textContent)).querySelector('input.val').value; });
  ok('typing 20 into the speed field means 20 rpm', /^20 rpm$/.test(rpmNow), rpmNow);
  ok('and the bolt really turns at that', Math.abs((await boltsNow())[0].speed * 60 * 60 / (Math.PI*2) - 20) < 0.5, (await boltsNow())[0].speed);
  await p.evaluate(() => { Array.from(document.querySelectorAll('#opBody button')).find(x => /Wobble bolt/.test(x.textContent)).click(); });
  await p.waitForTimeout(200);
  ok('switching to Wobble shows swing and timing', await p.evaluate(() => /swing/i.test(document.getElementById('opBody').innerText) && /timing/i.test(document.getElementById('opBody').innerText)));
  await p.evaluate(() => { Array.from(document.querySelectorAll('#opBody button')).find(x => /Sprung bolt/.test(x.textContent)).click(); });
  await p.waitForTimeout(200);
  ok('switching to Sprung shows spring strength', await p.evaluate(() => /spring/i.test(document.getElementById('opBody').innerText) && /strength/i.test(document.getElementById('opBody').innerText)));
  await p.keyboard.press('Delete');
  await p.waitForTimeout(250);
  ok('Del removes the bolt', (await boltsNow()).length === 0);
  ok('and closes the box', !(await p.evaluate(() => window.__pg.ctxOpen())));
  await p.evaluate(() => window.__pg.undo());
  await p.waitForTimeout(350);
  ok('undo brings it back as it was', (await boltsNow()).length === 1 && (await boltsNow())[0].kind === 'sprung', await boltsNow());

  console.log('');
  console.log('== it saves what it is ==');
  const b4 = await postAndArm('wobblebolt');
  await p.evaluate(id => window.__pg.boltSet(id, { dir:-1, angle:70, period:3.5, tightness:0.3 }), b4.id);
  const data = await p.evaluate(() => window.__pg.serialize('bolts'));
  const saved = data.bolts[0];
  ok('the save carries kind, layer and every setting', saved.kind === 'wobble' && saved.layer === 1 && saved.angle === 70 && Math.abs(saved.period - 3.5) < 1e-6 && saved.dir === -1, saved);
  await p.evaluate(d => window.__pg.load(d), data);
  await p.waitForTimeout(300);
  const back = (await boltsNow())[0];
  ok('and they come back', back && back.kind === 'wobble' && back.angle === 70 && back.dir === -1, back);
  const old = JSON.parse(JSON.stringify(data));
  delete old.bolts[0].kind; delete old.bolts[0].speed; delete old.bolts[0].tightness; delete old.bolts[0].layer; delete old.bolts[0].dir;
  old.bolts[0].mode = 'ccw'; old.world.motorSpeed = 0.17;
  await p.evaluate(d => window.__pg.load(d), old);
  await p.waitForTimeout(300);
  const oldBack = (await boltsNow())[0];
  ok('an old level\'s ccw bolt loads as an anticlockwise motor at the world speed',
     oldBack && oldBack.kind === 'motor' && oldBack.dir === -1 && Math.abs(oldBack.speed - 0.17) < 1e-6, oldBack);

  console.log('');
  console.log('== flipping carries the bolt ==');
  const b5 = await postAndArm('bolt');
  await p.evaluate(() => { window.__pg.setTool('move'); const o = window.__pg.objects().filter(q => !q.body.isStatic)[0]; window.__pg.select(o); });
  const before = await p.evaluate(id => window.__pg.boltGapTrue(id), b5.id);
  await p.evaluate(() => window.__pg.flip());
  await p.waitForTimeout(300);
  const after = await p.evaluate(id => window.__pg.boltGapTrue(id), b5.id);
  ok('the joint is still closed after a flip', after.gap < 2, { before: before.gap, after: after.gap });

  console.log('');
  console.log('== a bolt can be dragged to a new spot ==');
  const mv = await postAndArm('motorbolt');
  await p.evaluate(id => window.__pg.boltSet(id, { speed: 0.09, dir: -1 }), mv.id);
  await p.evaluate(() => window.__pg.setTool('move'));
  const dragTo = async (fx, fy, tx, ty) => {
    const a = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [fx, fy]), c = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [tx, ty]);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(300);
  };
  await dragTo(mv.x, mv.y, X+45, Y+25);               // still over the post, lower down the arm
  let bm = (await boltsNow())[0];
  ok('dragging the bolt moves its pivot', Math.abs(bm.x - (X+45)) < 4 && Math.abs(bm.y - (Y+25)) < 4, { at:[bm.x, bm.y], want:[X+45, Y+25] });
  ok('and it keeps its settings', bm.kind === 'motor' && Math.abs(bm.speed - 0.09) < 1e-6 && bm.dir === -1, bm);
  await dragTo(bm.x, bm.y, X+180, Y+15);              // on the arm alone: nothing behind it there
  const bm2 = (await boltsNow())[0];
  ok('dropping it where there is nothing to pin to leaves it where it was', Math.abs(bm2.x - bm.x) < 3 && Math.abs(bm2.y - bm.y) < 3, { from:[bm.x,bm.y], now:[bm2.x,bm2.y] });
  await p.evaluate(() => window.__pg.paused(false)); await p.waitForTimeout(700);
  ok('and it still drives after the move', Math.abs(await rel(bm2.id)) > 10, await rel(bm2.id));

  console.log('');
  console.log((fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join(String.fromCharCode(10)) : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
