/* The Creature eye: drop it on an object and the object chases the player
   — left and right, or floating anywhere — and dies when stood on.
   node tcreature.js */
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
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    for (const q of [a, c]) if (q.x < 2 || q.y < 2 || q.x > 1278 || q.y > 758) throw new Error('paint point off the screen: ' + JSON.stringify(q));
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const stats = () => p.evaluate(() => window.__pg.stats());
  const eye = () => p.evaluate(() => window.__pg.gadgets()).then(gs => gs.filter(g => g.kind === 'eye')[0]);
  const crate = () => stats().then(st => st.filter(o => o.pieces.some(pc => pc.indexOf('sponge') === 0))[0]);   // the creature's body is sponge
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(false); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const build = async () => { await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(300); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };
  // a floor, and a sponge block with an eye on it
  const scene = async (locked) => {
    await fresh();
    await rect('wood', 1, X-380, Y+100, X+400, Y+140);
    await lockAll();
    await rect('sponge', 1, X+100, Y+40, X+160, Y+100);
    if (locked) await lockAll();
    await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('eye'); });
    await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+130, Y+55]);
    return await eye();
  };

  console.log('');
  console.log('== it chases the player, left and right, and stops short ==');
  const e0 = await scene(false);
  ok('a creature eye can be placed on a block', !!e0 && e0.speed === 90 && e0.range === 700 && e0.fly === false && e0.deadly === true, e0);
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 200 }), e0.id);
  await play();
  await standAt(X-250, Y+60);                                // to the left, on the floor
  const c0 = await crate();
  await p.waitForTimeout(700);
  const c1 = await crate();
  console.log('   block went from', Math.round(c0.pos.x), 'to', Math.round(c1.pos.x), '; player at', Math.round((await pos()).x));
  ok('it walks toward the player', c1.pos.x < c0.pos.x - 80, { from: c0.pos.x, to: c1.pos.x });
  ok('and stays on the ground while it does', Math.abs(c1.pos.y - c0.pos.y) < 6, { y0: c0.pos.y, y1: c1.pos.y });
  await p.waitForTimeout(1500);
  const c2 = await crate(), pp2 = await pos();
  ok('it stops just short of the player rather than shoving in', c2.pos.x > pp2.x + 30 && c2.pos.x < pp2.x + 90, { block: c2.pos.x, player: pp2.x });
  ok('the eye looks at the player', (await eye()).look.x < -0.9, (await eye()).look);
  await standAt(X+350, Y+60); await p.waitForTimeout(900);   // now to the right
  const c3 = await crate();
  ok('walk past it and it turns round and follows', c3.pos.x > c2.pos.x + 80, { from: c2.pos.x, to: c3.pos.x });
  await build();

  console.log('');
  console.log('== out of sight it stays put; locked it only watches ==');
  const e1 = await scene(false);
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 200, range: 150 }), e1.id);
  await play();
  await standAt(X-250, Y+60);                                // 380px away: out of its sight
  const s0 = await crate(); await p.waitForTimeout(800); const s1 = await crate();
  ok('with the player out of sight it does not move', Math.abs(s1.pos.x - s0.pos.x) < 4, { from: s0.pos.x, to: s1.pos.x });
  await standAt(X+20, Y+60); await p.waitForTimeout(600);    // in range now
  ok('in sight, it comes', (await crate()).pos.x < s1.pos.x - 40, { from: s1.pos.x, to: (await crate()).pos.x });
  await build();
  const e2 = await scene(true);
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 200 }), e2.id);
  await play();
  await standAt(X-250, Y+60);
  const l0 = await crate(); await p.waitForTimeout(800); const l1 = await crate();
  ok('a locked block with an eye does not move', Math.abs(l1.pos.x - l0.pos.x) < 1, { from: l0.pos.x, to: l1.pos.x });
  ok('but its eye still follows you', (await eye()).look.x < -0.9, (await eye()).look);
  await build();

  console.log('');
  console.log('== a floating creature comes from any direction ==');
  const e3 = await scene(false);
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 200, fly: true }), e3.id);
  await rect('wood', 1, X-380, Y-200, X-100, Y-160);         // a high ledge to stand on
  await lockAll(); await p.evaluate(() => { const gs = window.__pg.objects(); /* the block was locked by lockAll: free it again */ gs.forEach(o => { if (o.pieces[0] && o.pieces[0].m === 'sponge'){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  await play();
  await standAt(X-240, Y-230);                               // up on the ledge, left
  const f0 = await crate(); await p.waitForTimeout(1200); const f1 = await crate();
  console.log('   flier went from', Math.round(f0.pos.x), Math.round(f0.pos.y), 'to', Math.round(f1.pos.x), Math.round(f1.pos.y));
  ok('it rises toward the player as well as coming across', f1.pos.y < f0.pos.y - 80 && f1.pos.x < f0.pos.x - 80, { from: f0.pos, to: f1.pos });
  await build();

  console.log('');
  console.log('== landing on the eye kills it ==');
  const e4 = await scene(false);
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 0.01, range: 60 }), e4.id);   // sits still: it cannot see us
  await play();
  ok('the block is there', !!(await crate()));
  await standAt(X+130, Y-60);                                // dropped onto the eye from above
  await p.waitForTimeout(500);
  ok('stood on, the creature is gone', !(await crate()) && !(await eye()));
  await build();
  ok('back in Build the block is where it was built', !!(await crate()) && !!(await eye()));
  const e5 = await scene(false);
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 0.01, range: 60, deadly: false }), e5.id);
  await play();
  await standAt(X+130, Y-60); await p.waitForTimeout(500);
  ok('set to be unsquashable, it survives being stood on', !!(await crate()) && !!(await eye()));
  await build();
  const sv = await p.evaluate(() => window.__pg.serialize('creature'));
  const gs = sv.gadgets.filter(g => g.kind === 'eye')[0];
  ok('the save carries the creature\'s settings', gs && gs.range === 60 && gs.deadly === false && gs.fly === false, gs);
  await p.evaluate(sv => window.__pg.load(sv), sv); await p.waitForTimeout(300);
  const eb = await eye();
  ok('and a load brings them back', eb && eb.range === 60 && eb.deadly === false, eb);

  console.log('');
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
