/* The jump: forgiving at the edges, and never off a wall.  node tjump.js */
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
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(false); });
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };
  // the highest point reached over the next while
  const peakOver = async (ms) => { let top = Infinity; const t0 = Date.now(); while (Date.now() - t0 < ms){ top = Math.min(top, (await pos()).y); await p.waitForTimeout(16); } return top; };

  console.log('');
  console.log('== a plain jump ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);          // floor
  await lockAll();
  await play();
  await standAt(X, Y+60); await p.waitForTimeout(400);
  const g0 = (await pos()).y;
  await p.keyboard.press('Space');
  const jumpTop = await peakOver(600);
  const oneJump = g0 - jumpTop;
  console.log('   a jump rises', oneJump.toFixed(0) + 'px');
  ok('Space on the ground jumps', oneJump > 100, oneJump);
  await p.waitForTimeout(800);

  console.log('');
  console.log('== no climbing walls ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);          // floor
  await rect('wood', 1, X+60, Y-200, X+140, Y+100);           // a wall to the right, taller than a jump, inside the view
  await lockAll();
  await play();
  await standAt(X+18, Y+60); await p.waitForTimeout(400);     // right up against it
  const w0 = (await pos()).y;
  await p.keyboard.down('KeyD');                              // pressing into the wall the whole time
  await p.waitForTimeout(100);
  let wallTop = w0;
  for (let i = 0; i < 10; i++){                               // hammer jump while pressed against it
    await p.keyboard.press('Space');
    const t0 = Date.now(); while (Date.now() - t0 < 120){ wallTop = Math.min(wallTop, (await pos()).y); await p.waitForTimeout(16); }
  }
  await p.keyboard.up('KeyD');
  await p.waitForTimeout(900);
  const w1 = (await pos()).y;
  console.log('   highest point', (w0 - wallTop).toFixed(0) + 'px up the wall; one jump is', oneJump.toFixed(0));
  ok('hammering jump against a wall gets you no higher than one jump', w0 - wallTop < oneJump * 1.25, { climbed: w0 - wallTop, oneJump });
  ok('and you end up back on the floor', Math.abs(w1 - w0) < 6, { before: w0, after: w1 });

  console.log('');
  console.log('== a moment of grace off a ledge ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X, Y+140);              // a ledge ending at X
  await rect('wood', 1, X-400, Y+400, X+600, Y+440);          // floor well below
  await lockAll();
  await play();
  const size = await p.evaluate(() => window.__pg.playerSize());
  await standAt(X-40, Y+60); await p.waitForTimeout(400);
  const l0 = (await pos()).y;
  await p.keyboard.down('KeyD');
  // walk off, and press the moment you are past the edge
  for (let i = 0; i < 200; i++){ const q = await pos(); if (q.x - size.w/2 > X + 1) break; await p.waitForTimeout(8); }
  const pressAt = await pos();
  await p.keyboard.press('Space');
  await p.keyboard.up('KeyD');
  const graceTop = await peakOver(500);
  console.log('   pressed', (pressAt.x - size.w/2 - X).toFixed(1) + 'px past the edge, rose', (pressAt.y - graceTop).toFixed(0) + 'px');
  ok('you were already off the ledge when you pressed', pressAt.x - size.w/2 > X, pressAt);
  ok('and still got the jump', pressAt.y - graceTop > 60, { from: pressAt.y, top: graceTop });
  // but not after the moment has passed
  await standAt(X-40, Y+60); await p.waitForTimeout(400);
  await p.keyboard.down('KeyD');
  for (let i = 0; i < 200; i++){ const q = await pos(); if (q.x - size.w/2 > X + 1) break; await p.waitForTimeout(8); }
  await p.keyboard.up('KeyD');
  await p.waitForTimeout(220);                                 // past the grace, still in the air
  const late = await pos();
  await p.keyboard.press('Space');
  const lateTop = await peakOver(150);                         // before it lands on the floor below
  ok('too late, and it is just a fall', late.y - lateTop < 5, { from: late.y, top: lateTop });
  // and grace is not a second jump
  await standAt(X-200, Y+60); await p.waitForTimeout(400);
  const d0 = (await pos()).y;
  await p.keyboard.press('Space'); await p.waitForTimeout(50); await p.keyboard.press('Space');
  const dblTop = await peakOver(600);
  ok('pressing again just after a jump does not add to it', d0 - dblTop < oneJump * 1.2, { twoPresses: d0 - dblTop, oneJump });

  console.log('');
  console.log('== a press just before landing counts ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);          // floor
  await lockAll();
  await play();
  await standAt(X, Y+60); await p.waitForTimeout(400);
  const floorY = (await pos()).y;
  // drop from a height, and press while still a little way up
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X, floorY - 260]);
  for (let i = 0; i < 300; i++){ const q = await pos(); if (q.y > floorY - 45) break; await p.waitForTimeout(5); }
  const early = await pos();
  await p.keyboard.press('Space');
  await p.waitForTimeout(150);                                 // landed by now
  const bufTop = await peakOver(600);
  console.log('   pressed', (floorY - early.y).toFixed(0) + 'px above the floor; then rose to', (floorY - bufTop).toFixed(0) + 'px');
  ok('pressed while still in the air', early.y < floorY - 10, { at: early.y, floor: floorY });
  ok('and it jumped on landing anyway', floorY - bufTop > 60, { top: bufTop, floor: floorY });
  await p.waitForTimeout(800);
  // a press far too early is thrown away
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X, floorY - 260]);
  await p.waitForTimeout(30);
  await p.keyboard.press('Space');                             // pressed right at the top of the drop
  await p.waitForTimeout(900);                                 // long landed
  const stale = await peakOver(400);
  ok('a press long before landing does not fire on landing', floorY - stale < 10, { top: stale, floor: floorY });

  console.log('');
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
