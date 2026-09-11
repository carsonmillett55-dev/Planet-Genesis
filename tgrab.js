/* Grabbing, the LBP way: hold grab while touching grabbable material and
   your hands close on it. Swing from a hanging sponge, drag a loose one,
   let go and jump.  node tgrab.js */
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
  const grabbing = () => p.evaluate(() => window.__pg.grabbing());
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const stats = () => p.evaluate(() => window.__pg.stats());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(false); });
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };

  console.log('');
  console.log('== hold grab while touching sponge ==');
  await fresh();
  await rect('wood', 1, X-200, Y+100, X+300, Y+140);       // floor
  await rect('sponge', 1, X, Y, X+80, Y+100);              // a sponge block on it
  await lockAll();
  await play();
  await standAt(X-22, Y+60);                               // right beside the sponge, touching
  ok('nothing is held before the key', !(await grabbing()));
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('holding Q beside sponge grabs it', await grabbing());
  await p.keyboard.up('KeyQ'); await p.waitForTimeout(200);
  ok('letting go lets go', !(await grabbing()));
  await standAt(X-300, Y+60);                              // nowhere near it
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('holding Q with nothing grabbable in reach grabs nothing', !(await grabbing()));
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== only grabbable material ==');
  await fresh();
  await rect('wood', 1, X-200, Y+100, X+300, Y+140);
  await rect('wood', 1, X, Y, X+80, Y+100);                // a wood block, same spot
  await lockAll();
  await play();
  await standAt(X-22, Y+60);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('wood cannot be grabbed', !(await grabbing()));
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== the right mouse button grabs too ==');
  await fresh();
  await rect('wood', 1, X-200, Y+100, X+300, Y+140);
  await rect('sponge', 1, X, Y, X+80, Y+100);
  await lockAll();
  await play();
  await standAt(X-22, Y+60);
  const away = await w2p(X+400, Y-200);
  await p.mouse.move(away.x, away.y);                      // pointing nowhere in particular: no aiming
  await p.mouse.down({ button:'right' }); await p.waitForTimeout(250);
  ok('right mouse held grabs, wherever the mouse points', await grabbing());
  await p.mouse.up({ button:'right' }); await p.waitForTimeout(200);
  ok('and releasing it lets go', !(await grabbing()));

  console.log('');
  console.log('== swinging from a sponge on a rope ==');
  await fresh();
  await rect('wood', 1, X, Y-140, X+80, Y-60);             // a locked beam up high (below the HUD)
  await lockAll();
  await rect('sponge', 1, X+20, Y+80, X+60, Y+140);        // a small sponge hanging below it
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('rope'); });
  await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [X+40, Y-100]);
  await p.evaluate(([x,y]) => window.__pg.linkAt(x,y), [X+40, Y+110]);
  await play();
  await p.waitForTimeout(600);                             // let the sponge settle on its rope
  const sp = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0];
  ok('the sponge hangs from the rope', !!sp && sp.pos.y > Y-80 && sp.pos.y < Y+260, sp && sp.pos);
  // drop the player in beside it, grabbing on the way past
  await p.keyboard.down('KeyQ');
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [sp.pos.x - 34, sp.pos.y - 60]);
  await p.waitForTimeout(500);
  ok('grabbing in mid-air catches it', await grabbing());
  const hang0 = await pos();
  await p.waitForTimeout(1200);
  const hang1 = await pos();
  ok('you hang from it rather than falling to the floor', hang1.y < Y+300, { y: hang1.y, floor: 2330 });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(600); await p.keyboard.up('KeyD');
  await p.waitForTimeout(300);
  const hang2 = await pos();
  ok('pushing sideways swings you', Math.abs(hang2.x - hang1.x) > 15, { from: hang1.x, to: hang2.x });
  await p.keyboard.press('Space'); await p.waitForTimeout(200);
  ok('Space lets go', !(await grabbing()));
  const jumped = await pos();
  await p.waitForTimeout(150);
  ok('and jumps you off it', (await pos()).y < jumped.y + 40, { before: jumped.y, after: (await pos()).y });
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== dragging a loose sponge ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+400, Y+140);
  await lockAll();
  await rect('sponge', 1, X, Y+20, X+70, Y+100);            // loose sponge on the floor
  await play();
  await standAt(X-24, Y+60);
  await p.waitForTimeout(400);
  const bx0 = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0].pos.x;
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('grabbed the loose sponge', await grabbing());
  await p.keyboard.down('KeyA'); await p.waitForTimeout(900); await p.keyboard.up('KeyA');
  await p.keyboard.up('KeyQ'); await p.waitForTimeout(200);
  const bx1 = (await stats()).filter(o => !o.static && o.pos.y < 2300)[0].pos.x;
  ok('walking away drags it along', bx1 < bx0 - 20, { from: bx0, to: bx1 });

  console.log('');
  console.log('== the grip survives the object being rebuilt ==');
  await fresh();
  await rect('wood', 1, X-200, Y+100, X+300, Y+140);
  await rect('sponge', 1, X, Y, X+80, Y+100);
  await lockAll();
  await p.evaluate(() => { window.__pg.paused(false); });
  await standAt(X-22, Y+60);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('grabbed it in Build with the world running', await grabbing());
  await p.evaluate(() => { window.__pg.setTool('move'); const o = window.__pg.objects().find(q => q.pieces[0].m === 'sponge'); window.__pg.select(o); window.__pg.flip(); });
  await p.waitForTimeout(300);
  ok('flipping the sponge under your hands keeps the grip', await grabbing());
  await p.keyboard.up('KeyQ');

  console.log('');
  console.log('== sprint on Shift ==');
  await fresh();
  await rect('wood', 1, X-400, Y+100, X+600, Y+140);
  await lockAll();
  await play();
  await standAt(X-300, Y+60); await p.waitForTimeout(300);
  const w0 = await pos();
  await p.keyboard.down('KeyD'); await p.waitForTimeout(800); await p.keyboard.up('KeyD');
  await p.waitForTimeout(150);
  const walked = (await pos()).x - w0.x;
  await standAt(X-300, Y+60); await p.waitForTimeout(300);
  const s0 = await pos();
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyD'); await p.waitForTimeout(800); await p.keyboard.up('KeyD'); await p.keyboard.up('ShiftLeft');
  await p.waitForTimeout(150);
  const sprinted = (await pos()).x - s0.x;
  console.log('   walked', walked.toFixed(0) + 'px, sprinted', sprinted.toFixed(0) + 'px in the same time');
  ok('holding Shift is quicker', sprinted > walked * 1.25, { walked, sprinted });
  ok('but only a bit — not a dash', sprinted < walked * 1.8, { walked, sprinted });

  console.log('');
  console.log((fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join(String.fromCharCode(10)) : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
