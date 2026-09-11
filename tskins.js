/* Drawn looks: a creature drawn in the studio over its body, an animated
   object with an action a wire plays, walk-through objects, and particles
   with pictures.  node tskins.js */
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
  const kind = (k) => gadgets().then(gs => gs.filter(g => g.kind === k)[0]);
  const st = (cmd, a, b2) => p.evaluate(([c, x, y]) => window.__pg.studio(c, x, y), [cmd, a, b2]);
  const stats = () => p.evaluate(() => window.__pg.stats());
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(true); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const build = async () => { await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(300); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };
  // a stroke on the studio canvas
  const stroke = async (fx0, fy0, fx1, fy1) => {
    const r = await st('canvasRect');
    await p.mouse.move(r.x + r.w * fx0, r.y + r.h * fy0); await p.mouse.down(); await p.mouse.move(r.x + r.w * fx1, r.y + r.h * fy1, { steps: 6 }); await p.mouse.up();
    await p.waitForTimeout(60);
  };
  const skinHasStrokes = async (id) => { const sk = await p.evaluate(i => window.__pg.skinOf(i), id); return sk ? Object.keys(sk.states).reduce((n, k) => n + sk.states[k].reduce((m, f) => m + f.length, 0), 0) : 0; };

  console.log('');
  console.log('== a creature is drawn in the studio, over its own body ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+300, Y+140);
  await rect('sponge', 1, X, Y-20, X+140, Y+100);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('eye'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+70, Y+10]);
  const eye = await kind('eye');
  ok('a fresh creature has no drawing', eye && !eye.hasSkin);
  ok('its box opens the studio for it', await p.evaluate(id => window.__pg.skinStudio(id), eye.id));
  await p.waitForTimeout(150);
  const chips = await p.evaluate(() => Array.from(document.querySelectorAll('#ceLeft .ceChips button')).map(b => b.textContent));
  ok('with Idle, Moving and Action states', chips.some(c => /Idle/.test(c)) && chips.some(c => /Moving/.test(c)) && chips.some(c => /Action/.test(c)), chips);
  const asp = await st('canvasRect');
  ok('and a drawing box shaped like the creature (140 by 120)', Math.abs(asp.w / asp.h - 140/120) < 0.05, asp.w / asp.h);
  await st('setColor', '#E8567A');
  await stroke(0.2, 0.3, 0.8, 0.7);
  await st('go', 'move', 0); await stroke(0.2, 0.7, 0.8, 0.3);
  await st('click', '+ blank'); await stroke(0.5, 0.2, 0.5, 0.8);
  await st('close');
  ok('the drawing is on the creature', (await kind('eye')).hasSkin && (await skinHasStrokes(eye.id)) === 3, await skinHasStrokes(eye.id));
  // the creature plays Idle standing, Moving when it chases, and faces the way it goes
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 200, range: 500 }), eye.id);
  await play();
  await standAt(X-250, Y+60); await p.waitForTimeout(500);
  const stMoving = await p.evaluate(id => window.__pg.skinState(id), (await kind('eye')).id);
  const face = (await kind('eye')).face;
  ok('chasing, it shows its Moving frames', stMoving === 'move', stMoving);
  ok('and faces the player, to its left', face === -1, face);
  await build();
  // save and load carry the drawing
  const sv = await p.evaluate(() => window.__pg.serialize('skin'));
  const gs = sv.gadgets.filter(g => g.kind === 'eye')[0];
  ok('the save carries the drawing', gs && gs.skin && gs.skin.states.idle[0].length === 1 && gs.skin.states.move.length === 2, gs && gs.skin && Object.keys(gs.skin.states));
  await p.evaluate(sv => window.__pg.load(sv), sv); await p.waitForTimeout(300);
  ok('and a load brings it back', (await kind('eye')).hasSkin && (await skinHasStrokes((await kind('eye')).id)) === 3);

  console.log('');
  console.log('== a wire plays the creature\'s Action ==');
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('lever'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-200, Y+100]);
  const lv = await kind('lever');
  ok('a lever can be wired to a creature', await p.evaluate(([a,b]) => window.__pg.wire(a,b), [lv.id, (await kind('eye')).id]));
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), lv.id);
  await play(); await p.waitForTimeout(300);
  ok('lever on: the creature shows its Action', (await p.evaluate(id => window.__pg.skinState(id), (await kind('eye')).id)) === 'action');
  await build();

  console.log('');
  console.log('== an animated object: idle loops, a wire plays the action once and holds, and it can be walk-through ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+300, Y+140);
  await rect('metal', 1, X, Y-60, X+80, Y+100);          // a door
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('anim'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+40, Y+20]);
  const an = await kind('anim');
  ok('an animated object can be placed from the Tools', !!an && an.actionMode === 'loop' && !an.ghost, an);
  ok('its studio opens', await p.evaluate(id => window.__pg.skinStudio(id), an.id));
  await p.waitForTimeout(150);
  await st('setColor', '#5F9E5A'); await stroke(0.2, 0.2, 0.8, 0.8);
  await st('go', 'action', 0); await stroke(0.2, 0.8, 0.8, 0.2); await st('click', '+ blank'); await stroke(0.5, 0.1, 0.5, 0.9);
  await st('close');
  ok('drawn: idle and a two-frame action', (await skinHasStrokes(an.id)) === 3, { strokes: await skinHasStrokes(an.id), skin: await p.evaluate(i => window.__pg.skinOf(i), an.id) });
  await p.evaluate(id => window.__pg.gadgetSet(id, { actionMode: 'once' }), an.id);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('lever'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-200, Y+100]);
  const lv2 = await kind('lever');
  await p.evaluate(([a,b]) => window.__pg.wire(a,b), [lv2.id, an.id]);
  await play(); await p.waitForTimeout(200);
  ok('unwired-off it shows idle', (await p.evaluate(id => window.__pg.skinState(id), (await kind('anim')).id)) === 'idle');
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), (await kind('lever')).id);
  await play(); await p.waitForTimeout(300);
  ok('lever on, it plays the action', (await p.evaluate(id => window.__pg.skinState(id), (await kind('anim')).id)) === 'action');
  // walk-through
  await build();
  await standAt(X-60, Y+60);
  await play();
  await standAt(X-30, Y+60); await p.keyboard.down('KeyD'); await p.waitForTimeout(600); await p.keyboard.up('KeyD');
  const solidX = (await pos()).x;
  ok('solid, the door stops the player', solidX < X + 10, solidX);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { ghost: true }), (await kind('anim')).id);
  await p.evaluate(id => window.__pg.refreshHost(id), (await kind('anim')).id);
  await play();
  await standAt(X-30, Y+60); await p.keyboard.down('KeyD'); await p.waitForTimeout(600); await p.keyboard.up('KeyD');
  const ghostX = (await pos()).x;
  ok('set to no collision, the player walks straight through it', ghostX > X + 60, ghostX);
  await build();

  console.log('');
  console.log('== particles with pictures ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+300, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('emitter'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X, Y+100]);
  const em = await kind('emitter');
  ok('an emitter can be placed, with a rate, speed, life and size', !!em && em.rate === 8 && em.pspeed === 160 && em.life === 1.4 && em.psize === 28, em);
  await play(); await p.waitForTimeout(600);
  ok('nothing comes out until a particle is drawn', (await p.evaluate(() => window.__pg.sprites())) === 0);
  await build();
  const emId = (await kind('emitter')).id;                   // (ids are renumbered by the mode switch)
  const opened = await p.evaluate(id => window.__pg.skinStudio(id), emId);
  await p.waitForTimeout(150);                                 // the stage lays itself out on the next frame
  const cr = await st('canvasRect');
  ok('its studio opens on a square box', opened && Math.abs(cr.w / cr.h - 1) < 0.05, cr);
  await st('setColor', '#F2B705'); await stroke(0.3, 0.5, 0.7, 0.5);
  await st('close');
  ok('the particle is drawn', (await skinHasStrokes(emId)) === 1);
  await play(); await p.waitForTimeout(900);
  const n1 = await p.evaluate(() => window.__pg.sprites());
  ok('drawn, it throws particles out', n1 > 4 && n1 < 30, n1);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { rate: 40, life: 0.5 }), (await kind('emitter')).id);
  await play(); await p.waitForTimeout(1200);
  const n2 = await p.evaluate(() => window.__pg.sprites());
  ok('more a second and a shorter life: about rate × life of them alive', n2 > 12 && n2 < 32, n2);
  await build();
  // wired: only while on
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('lever'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-200, Y+100]);
  await p.evaluate(([a,b]) => window.__pg.wire(a,b), [(await kind('lever')).id, (await kind('emitter')).id]);
  await play(); await p.waitForTimeout(1200);
  ok('wired to a lever that is off, it emits nothing', (await p.evaluate(() => window.__pg.sprites())) === 0);
  await build();
  const sv2 = await p.evaluate(() => window.__pg.serialize('em'));
  const ge = sv2.gadgets.filter(g => g.kind === 'emitter')[0];
  ok('the save carries the particle drawing and its settings', ge && ge.skin && ge.skin.states.particle[0].length === 1 && ge.rate === 40 && ge.life === 0.5, ge && { rate: ge.rate, life: ge.life });

  console.log('');
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
