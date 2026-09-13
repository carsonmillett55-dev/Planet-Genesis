/* Top-down (2.5D): a level seen from above — no gravity, the arrows walk
   every way, no jump, the character looks at the cursor, loose things
   slide and stop, water stays put, creatures chase every way; back to
   an adventure and gravity is back.  node ttopdown.js */
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
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); window.__pg.setPaintMode('rect'); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const gadgets = () => p.evaluate(() => window.__pg.gadgets());
  const kinds = (k) => gadgets().then(gs => gs.filter(g => g.kind === k));
  const G = async (k, i) => (await kinds(k))[i || 0];
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const objs = () => p.evaluate(() => window.__pg.objects().map(o => ({ x: o.body.position.x, y: o.body.position.y, still: o.body.isStatic, mats: o.pieces.map(q => q.m) })));
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(true); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const build = async () => { await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(300); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };
  const place = async (k, x, y) => { await p.evaluate(kk => { window.__pg.setLayer(1); window.__pg.setTool(kk); }, k); await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [x,y]); return kinds(k).then(gs => gs[gs.length - 1]); };
  const wset = (k, v) => p.evaluate(([k, v]) => window.__pg.worldSet(k, v), [k, v]);
  const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };
  const moveMouseTo = async (x, y) => { const s = await w2p(x, y); await p.mouse.move(s.x, s.y); await p.waitForTimeout(120); };

  console.log('== a top-down level: no gravity, a disc of a body ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);   // a wall along the bottom
  await lockAll();
  ok('an adventure has gravity', (await p.evaluate(() => window.__pg.gravityY())) > 0);
  ok('the type can be picked', await p.evaluate(() => { window.__pg.menu('world', 'level'); return Array.from(document.querySelectorAll('.typeCard')).some(c => /Top-down/.test(c.textContent) && !c.disabled); }));
  await p.evaluate(() => window.__pg.menu(null));
  await wset('levelType', 'topdown');
  await p.evaluate(() => window.__pg.worldSet('levelType', 'topdown'));
  await p.waitForTimeout(200);
  ok('top-down: no gravity', (await p.evaluate(() => window.__pg.gravityY())) === 0, await p.evaluate(() => window.__pg.gravityY()));
  await rect('wood', 1, X+200, Y-200, X+260, Y-140);   // a loose crate, mid-air
  await play(); await standAt(X, Y-100);
  await p.waitForTimeout(600);
  const still = await pos();
  ok('the character hangs where they are put — nothing falls', Math.abs(still.y - (Y-100)) < 4 && Math.abs(still.x - X) < 4, still);
  ok('the body is a disc', (await p.evaluate(() => window.__pg.bodyKind())) === 'disc');
  const crate = (await objs()).filter(o => !o.still)[0];
  ok('a loose crate stays put too', crate && Math.abs(crate.y - (Y-170)) < 6, crate);

  console.log('== the arrows walk every way, Space does nothing ==');
  await standAt(X, Y-100);
  let a = await pos(); await hold('ArrowUp', 300); let q = await pos();
  ok('Up walks up', q.y < a.y - 40 && Math.abs(q.x - a.x) < 4, { from: a, to: q });
  a = await pos(); await hold('ArrowDown', 300); q = await pos();
  ok('Down walks down (no crouch)', q.y > a.y + 40 && Math.abs(q.x - a.x) < 4, { from: a, to: q });
  a = await pos(); await hold('ArrowRight', 300); q = await pos();
  ok('Right walks right', q.x > a.x + 40 && Math.abs(q.y - a.y) < 4, { from: a, to: q });
  a = await pos(); await p.keyboard.down('ArrowLeft'); await p.keyboard.down('ArrowUp'); await p.waitForTimeout(300); await p.keyboard.up('ArrowLeft'); await p.keyboard.up('ArrowUp'); q = await pos();
  ok('two arrows walk diagonally, at walking pace', q.x < a.x - 25 && q.y < a.y - 25 && Math.abs((a.x - q.x) - (a.y - q.y)) < 22, { from: a, to: q });   // the two keys go down a frame or two apart
  await p.waitForTimeout(150);
  a = await pos(); await p.keyboard.press('Space'); await p.waitForTimeout(400); q = await pos();
  ok('Space is a dash, not a jump — a burst along the ground, and it stops', (await p.evaluate(() => window.__pg.dash())).until > 0 && Math.abs((await pos()).y - q.y) < 2, { from: a, to: q, dash: await p.evaluate(() => window.__pg.dash()) });
  ok('letting go stops', Math.abs((await pos()).y - q.y) < 2);

  console.log('== the character looks at the cursor ==');
  await standAt(X, Y-100);
  await moveMouseTo(X+200, Y-100);
  let look = await p.evaluate(() => window.__pg.look());
  ok('cursor to the right: it looks right', look != null && Math.abs(look) < 0.2, look);
  await moveMouseTo(X, Y-300);
  look = await p.evaluate(() => window.__pg.look());
  ok('cursor above: it looks up', look != null && Math.abs(look + Math.PI/2) < 0.2, look);
  await moveMouseTo(X-200, Y-100);
  look = await p.evaluate(() => window.__pg.look());
  ok('cursor to the left: it looks left', look != null && Math.abs(Math.abs(look) - Math.PI) < 0.2, look);

  console.log('== a shove slides and stops; water is a still pool ==');
  await standAt(X+170, Y-170);   // beside the crate, to its left
  await moveMouseTo(X+400, Y-170);
  await hold('ArrowRight', 500);
  await p.waitForTimeout(100);
  const c1 = (await objs()).filter(o => !o.still)[0];
  await p.waitForTimeout(700);
  const c2 = (await objs()).filter(o => !o.still)[0];
  ok('walking into the crate shoves it along', c1 && c1.x > X+230 + 20, { was: X+230, now: c1 && c1.x });
  ok('and it comes to a stop rather than sliding for ever', c2 && Math.abs(c2.x - c1.x) < 60, { after: c1 && c1.x, later: c2 && c2.x });
  await build();
  await p.evaluate(([x, y]) => window.__pg.pour(x, y, 40, 1), [X-250, Y-260]);   // a pool in mid-air
  await p.waitForTimeout(200);
  const w0 = await p.evaluate(() => window.__pg.waterInfo().count);
  await play(); await p.waitForTimeout(1200);
  const stillWet = await p.evaluate(([x, y]) => window.__pg.waterLevelAt(x, y), [X-250, Y-260]);
  ok('water stays where it was put, mid-air', w0 > 0 && stillWet > 0.3 && Math.abs((await p.evaluate(() => window.__pg.waterInfo().count)) - w0) < w0 * 0.2 + 2, { w0, now: await p.evaluate(() => window.__pg.waterInfo().count), stillWet });

  console.log('== a creature chases every way from above ==');
  await build();
  await rect('wood', 1, X+100, Y-150, X+180, Y-70);   // (a drag must start on the screen, and clear of the top-left pills)
  await p.waitForTimeout(150);
  const post = (await objs()).filter(o => !o.still && o.mats[0] === 'wood' && Math.abs(o.x - (X+140)) < 30 && Math.abs(o.y - (Y-110)) < 30)[0];
  ok('a block for a creature', !!post, post);
  const eye = await place('eye', post.x, post.y);
  ok('an eye on it', !!eye);
  await p.evaluate(id => window.__pg.gadgetSet(id, { range: 900, speed: 120 }), eye.id);
  await play(); await standAt(post.x, post.y + 300);   // below it (past the bottom wall — from above, that is just further down)
  await p.waitForTimeout(1500);
  const cr = (await objs()).filter(o => !o.still && o.mats[0] === 'wood' && Math.abs(o.x - post.x) < 60)[0];
  ok('a walking creature comes DOWN toward the player, seen from above', cr && cr.y > post.y + 80, { post: post.y, now: cr && cr.y });
  const crAng = await p.evaluate(px => { const o = window.__pg.objects().filter(q => !q.body.isStatic && q.pieces[0].m === 'wood' && Math.abs(q.body.position.x - px) < 60)[0]; return o ? o.body.angle : null; }, post.x);
  ok('and has turned to face them (down: about a quarter turn)', crAng != null && Math.abs(crAng - Math.PI/2) < 0.6, crAng);

  console.log('== back to an adventure, gravity is back ==');
  await build();
  await wset('levelType', 'adventure');
  await p.waitForTimeout(100);
  ok('gravity again', (await p.evaluate(() => window.__pg.gravityY())) > 0);
  await play(); await p.waitForTimeout(300);
  ok('the body is the box again', (await p.evaluate(() => window.__pg.bodyKind())) === 'box');
  await standAt(X, Y-100); await p.waitForTimeout(500);
  ok('and the character falls', (await pos()).y > Y-60, await pos());
  await build();

  console.log('== saved with the level ==');
  await wset('levelType', 'topdown');
  const file = await p.evaluate(() => window.__pg.serialize());
  await wset('levelType', 'adventure');
  await p.evaluate(f => window.__pg.load(f), file);
  await p.waitForTimeout(200);
  ok('the kind loads back as top-down, with no gravity', (await p.evaluate(() => window.__pg.levelType())) === 'topdown' && (await p.evaluate(() => window.__pg.gravityY())) === 0, { t: await p.evaluate(() => window.__pg.levelType()), g: await p.evaluate(() => window.__pg.gravityY()) });
  await wset('levelType', 'adventure');

  console.log('== no page errors ==');
  ok('no errors', errs.length === 0, errs);
  await b.close();
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  process.exit(fail ? 1 : 0);
})();
