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
  await p.waitForTimeout(2000);                                // let that jump land: up and down is about 1.7s
  // a press far too early is thrown away
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X, floorY - 260]);
  await p.waitForTimeout(200);                                 // past the grace the floor just gave (a teleport is not a real step off a ledge)
  await p.keyboard.press('Space');                             // pressed near the top of the drop, half a second before landing
  await p.waitForTimeout(900);                                 // long landed
  const stale = await peakOver(400);
  ok('a press long before landing does not fire on landing', floorY - stale < 10, { top: stale, floor: floorY });

  console.log('');
  console.log('== ice is skated on: you coast, and a slope takes you down ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X-100, Y+140);          // a wooden run-up
  await rect('ice', 1, X-100, Y+100, X+400, Y+140);           // then ice
  await lockAll();
  await play();
  await standAt(X-300, Y+60); await p.waitForTimeout(400);
  await p.keyboard.down('KeyD'); await p.waitForTimeout(500); await p.keyboard.up('KeyD');   // run onto the ice and let go
  const letGo = (await pos()).x;
  await p.waitForTimeout(600);
  const later = (await pos()).x;
  ok('on ice, letting go of the key does not stop you: you coast on', later > letGo + 40, { letGo, later });
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  await play();
  await standAt(X-300, Y+60); await p.waitForTimeout(400);
  await p.keyboard.down('KeyD'); await p.waitForTimeout(500); await p.keyboard.up('KeyD');
  const letGoW = (await pos()).x;
  await p.waitForTimeout(400);
  ok('on wood you stop where you let go', Math.abs((await pos()).x - letGoW) < 12, { letGoW, later: (await pos()).x });
  // a slope of ice: a triangle, apex up; stood on its right side you slide down it with no key pressed
  await fresh();
  await rect('wood', 1, X-400, Y+140, X+400, Y+180);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('ice'); window.__pg.setPaintMode('tri'); });
  const ta = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X-200, Y-60]), tb = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+200, Y+140]);
  await p.mouse.move(ta.x, ta.y); await p.mouse.down(); await p.mouse.move(tb.x, tb.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
  await p.evaluate(() => { window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
  await lockAll();
  await play();
  await standAt(X+40, Y-30); await p.waitForTimeout(1200);
  const slid = await pos();
  ok('stood on an icy slope with no key down, you slide down it', slid.x > X + 40 + 60 && slid.y > Y - 30 + 20, slid);

  console.log('');
  console.log('== crouch: shorter, slower, under a low ceiling; a slide out of a run ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);          // floor
  await rect('wood', 1, X+100, Y+30, X+400, Y+60);            // a shelf 40px above the floor: too low to walk under (the character is 56 tall), fine crouched (34)
  await lockAll();
  await play();
  await standAt(X-100, Y+60); await p.waitForTimeout(500);
  const tall = await p.evaluate(() => window.__pg.playerSize());
  await p.keyboard.down('KeyS'); await p.waitForTimeout(150);
  const low = await p.evaluate(() => window.__pg.playerSize());
  const cs = await p.evaluate(() => window.__pg.charState());
  ok('Down on the ground crouches: the body is three fifths the height', low.h < tall.h * 0.7 && low.h > tall.h * 0.5 && cs.crouching, { tall: tall.h, low: low.h, cs });
  ok('and the pose is Crouch', cs.anim === 'crouch', cs.anim);
  const feetTall = (await pos()).y + low.h / 2;
  ok('the feet stay on the floor', Math.abs(feetTall - (Y + 100)) < 4, feetTall - (Y + 100));
  await p.keyboard.down('KeyD'); await p.waitForTimeout(1500); await p.keyboard.up('KeyD');
  const under = (await pos()).x;
  ok('crouched, you walk in under the low shelf', under > X + 140, under);
  await p.keyboard.up('KeyS'); await p.waitForTimeout(200);
  ok('letting go under the shelf keeps you crouched — there is no room to stand', (await p.evaluate(() => window.__pg.charState())).crouching === true);
  await p.keyboard.down('KeyA'); await p.waitForTimeout(1600); await p.keyboard.up('KeyA'); await p.waitForTimeout(200);
  ok('out from under it, you stand back up', (await p.evaluate(() => window.__pg.charState())).crouching === false && (await p.evaluate(() => window.__pg.playerSize())).h === tall.h, await p.evaluate(() => window.__pg.playerSize()));
  // the slide: at a run, press Down: you keep going with the keys off
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);
  await lockAll();
  await play();
  await standAt(X-300, Y+60); await p.waitForTimeout(500);
  await p.keyboard.down('KeyD'); await p.waitForTimeout(400);
  await p.keyboard.down('KeyS'); await p.keyboard.up('KeyD'); await p.waitForTimeout(60);
  const sl = await p.evaluate(() => window.__pg.charState());
  const x0 = (await pos()).x;
  await p.waitForTimeout(300);
  const x1 = (await pos()).x;
  ok('Down at a run is a slide', sl.sliding === true && sl.anim === 'slide', sl);
  ok('which carries you on with no key held', x1 > x0 + 40, { x0, x1 });
  await p.keyboard.up('KeyS'); await p.waitForTimeout(700);
  ok('and it is over within the second, standing again', (await p.evaluate(() => window.__pg.charState())).sliding === false && (await p.evaluate(() => window.__pg.charState())).crouching === false);

  console.log('');
  console.log('== the double jump, a level setting ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+400, Y+140);          // floor
  await lockAll();
  await p.evaluate(() => window.__pg.worldSet('doubleJump', false));
  await play();
  const stand = async () => { await standAt(X, Y+60); await p.waitForTimeout(500); };
  const ppos = pos;
  await stand();
  await p.keyboard.press('Space'); await p.waitForTimeout(220);
  const mid1 = (await ppos()).y;
  await p.keyboard.press('Space'); await p.waitForTimeout(220);
  const top1 = (await ppos()).y;
  ok('off: a second press in the air adds nothing', top1 > mid1 - 8, { mid: mid1, later: top1 });
  await p.evaluate(() => window.__pg.worldSet('doubleJump', true));
  await p.waitForTimeout(1200);
  await stand();
  await p.keyboard.press('Space'); await p.waitForTimeout(220);
  const mid2 = (await ppos()).y;
  await p.keyboard.press('Space'); await p.waitForTimeout(220);
  const top2 = (await ppos()).y;
  ok('on: a second press in the air jumps again', top2 < mid2 - 40, { mid: mid2, later: top2 });
  await p.keyboard.press('Space'); await p.waitForTimeout(220);
  const top3 = (await ppos()).y;
  ok('but only once before landing', top3 > top2 - 8, { after2nd: top2, after3rd: top3 });
  await p.waitForTimeout(1500);
  await p.keyboard.press('Space'); await p.waitForTimeout(220);
  const g2 = (await ppos()).y;
  await p.keyboard.press('Space'); await p.waitForTimeout(220);
  ok('landing gives it back', (await ppos()).y < g2 - 40);
  ok('and it is saved with the level', (await p.evaluate(() => window.__pg.serialize('dj').world.doubleJump)) === true);
  await p.evaluate(() => window.__pg.worldSet('doubleJump', false));

  console.log('');
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
