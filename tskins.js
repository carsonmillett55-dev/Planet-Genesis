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
  console.log('== a custom object: draw it, draw its hitbox, then its settings ==');
  await fresh();
  await rect('wood', 1, X-300, Y+100, X+300, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('anim'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X, Y+40]);  // on empty air: it brings its own body
  await p.waitForTimeout(200);
  let an = await kind('anim');
  ok('the tool puts a drawn object down and opens the studio', !!an && an.obj && !(await p.evaluate(() => document.getElementById('charEditorOverlay').hidden)), an);
  ok('starting as a plain box', Math.abs(an.art.w - 120) < 1 && Math.abs(an.art.h - 120) < 1, an.art);
  const objBefore = (await stats()).filter(o => o.id === an.obj)[0];
  ok('the body is that box for now', Math.abs(objBefore.area - 120*120) < 200, objBefore.area);
  // the look
  await st('setColor', '#5F9E5A'); await stroke(0.2, 0.2, 0.8, 0.8);
  await st('go', 'action', 0); await stroke(0.2, 0.8, 0.8, 0.2); await st('click', '+ blank'); await stroke(0.5, 0.1, 0.5, 0.9);
  // Next takes you to the hitbox
  const nextLabel = await p.evaluate(() => Array.from(document.querySelectorAll('#ceLeft button')).map(b => b.textContent).find(t => /^Next:/.test(t)));
  ok('a Next button leads to the hitbox', /Hitbox/.test(nextLabel || ''), nextLabel);
  await st('click', nextLabel);
  ok('the hitbox step is one drawing', (await st('where')).state === 'hitbox' && (await st('where')).frames === 1, await st('where'));
  await stroke(0.5, 0.15, 0.5, 0.85);                         // a thick vertical bar: the hitbox
  ok('the hitbox stroke is its own colour, whatever the brush had', (await st('drawing'))[0].c === '#4FA9D6');
  const doneLabel = await p.evaluate(() => Array.from(document.querySelectorAll('#ceLeft button')).map(b => b.textContent).find(t => /Done/.test(t)));
  ok('and then it is Done', !!doneLabel, doneLabel);
  await st('click', doneLabel); await p.waitForTimeout(300);
  an = await kind('anim');
  const objAfter = (await stats()).filter(o => o.id === an.obj)[0];
  ok('closing turns the drawn hitbox into the body: a bar, much less than the box', objAfter && objAfter.area < 120*120*0.5 && objAfter.area > 800, objAfter && objAfter.area);
  ok('the art box is kept as it was, so the look still lands where it was drawn', Math.abs(an.art.w - 120) < 1 && Math.abs(an.art.h - 120) < 1, an.art);
  ok('it is solid, not grabbable, locked, and its action loops', !an.ghost && an.actionMode === 'loop', an);
  // the settings from its box
  await p.evaluate(id => window.__pg.gadgetSet(id, { actionMode: 'once' }), an.id);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('lever'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-200, Y+100]);
  await p.evaluate(([a,b]) => window.__pg.wire(a,b), [(await kind('lever')).id, an.id]);
  await play(); await p.waitForTimeout(200);
  ok('unwired-off it shows idle', (await p.evaluate(id => window.__pg.skinState(id), (await kind('anim')).id)) === 'idle');
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), (await kind('lever')).id);
  await play(); await p.waitForTimeout(300);
  ok('lever on, it plays the action', (await p.evaluate(id => window.__pg.skinState(id), (await kind('anim')).id)) === 'action');
  await build();
  // solid: the bar stops the player; no collision: they walk through
  await play();
  await standAt(X-60, Y+60); await p.keyboard.down('KeyD'); await p.waitForTimeout(700); await p.keyboard.up('KeyD');
  const solidX = (await pos()).x;
  ok('solid, the drawn bar stops the player', solidX < X - 5, solidX);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { ghost: true }), (await kind('anim')).id);
  await p.evaluate(id => window.__pg.refreshHost(id), (await kind('anim')).id);
  await play();
  await standAt(X-60, Y+60); await p.keyboard.down('KeyD'); await p.waitForTimeout(700); await p.keyboard.up('KeyD');
  ok('set to no collision, the player walks straight through it', (await pos()).x > X + 40, (await pos()).x);
  await build();
  const svA = await p.evaluate(() => window.__pg.serialize('anim'));
  const gsA = svA.gadgets.filter(g => g.kind === 'anim')[0];
  ok('the save carries the drawing, the hitbox strokes and the art box', gsA && gsA.skin && gsA.hitbox && gsA.hitbox.length === 1 && gsA.art && gsA.art.w === 120, gsA && { hit: gsA.hitbox && gsA.hitbox.length, art: gsA.art });

  console.log('');
  console.log('== a custom creature: look, hitbox, weak spot, danger — then it lives ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('creature'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+100, Y+40]);
  await p.waitForTimeout(200);
  let cr = await kind('creature');
  ok('the tool puts a creature down and opens the studio', !!cr && !(await p.evaluate(() => document.getElementById('charEditorOverlay').hidden)), cr);
  const cchips = await p.evaluate(() => Array.from(document.querySelectorAll('#ceLeft .ceChips button')).map(b => b.textContent));
  ok('with Idle, Moving, Attack, Death, Action — then Hitbox, Weak spot, Danger', ['Idle','Moving','Attack','Death','Action','Hitbox','Weak spot','Danger'].every(w => cchips.some(c => c.indexOf(w) >= 0)), cchips);
  await st('setColor', '#C89BD9'); await stroke(0.2, 0.3, 0.8, 0.7);                         // idle
  await st('go', 'move', 0); await stroke(0.2, 0.7, 0.8, 0.3);
  await st('go', 'attack', 0); await stroke(0.5, 0.2, 0.5, 0.8);
  await st('go', 'die', 0); await stroke(0.2, 0.2, 0.8, 0.8); await st('click', '+ blank'); await stroke(0.8, 0.2, 0.2, 0.8);
  await st('go', 'hitbox', 0); await stroke(0.5, 0.2, 0.5, 0.8); await stroke(0.25, 0.5, 0.75, 0.5);   // a cross: a bar down the middle and one across
  await st('go', 'weakD', 0); await stroke(0.2, 0.2, 0.8, 0.2);                               // a band along the top edge of the bar
  await st('go', 'dangerD', 0); await stroke(0.2, 0.8, 0.8, 0.8);                             // and one along its bottom edge
  await st('close'); await p.waitForTimeout(300);
  cr = await kind('creature');
  ok('closing gives it a body from the hitbox', cr.hitStrokes === 2 && (await stats()).filter(o => o.id === cr.obj)[0].area < 120*120*0.5);
  ok('and the weak spot and danger as areas', cr.weakArea > 300 && cr.dangerArea > 300, { weak: cr.weakArea, danger: cr.dangerArea });
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 150, range: 600 }), cr.id);
  await play();
  const crObj = () => stats().then(stt => stt.filter(o => o.pieces.some(pc => pc.indexOf('creature') === 0))[0]);
  const c0 = await crObj();
  await standAt(X-250, Y+60); await p.waitForTimeout(700);
  const c1 = await crObj();
  ok('it follows the player', c1.pos.x < c0.pos.x - 40, { from: c0.pos.x, to: c1.pos.x });
  ok('facing them: drawn facing right, it now faces left', (await kind('creature')).face === -1 && (await kind('creature')).drawnFacing === 1);
  ok('and shows its Moving frames', (await p.evaluate(id => window.__pg.skinState(id), (await kind('creature')).id)) === 'move');
  // the danger: touching the bottom plays the Attack and hurts the player
  const cx = (await crObj()).pos.x, cyD = (await crObj()).pos.y;
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [cx, cyD + 44]); await p.waitForTimeout(120);   // into the band across the bottom
  const stA = await p.evaluate(id => window.__pg.skinState(id), (await kind('creature')).id);
  const pAfter = await pos();
  ok('touching the danger sends the player back to the start', pAfter.x < 200, pAfter);
  ok('and its Attack plays', stA === 'attack', stA);
  await p.waitForTimeout(1200);
  // the weak spot: the top; its Death plays before it goes
  const cx2 = (await crObj()).pos.x, cy2 = (await crObj()).pos.y;
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [cx2, cy2 - 50]); await p.waitForTimeout(150);   // onto the band across the top
  const gAfter = await kind('creature');
  ok('landing on the weak spot starts its Death', !!gAfter && gAfter.dying === true, gAfter && { dying: gAfter.dying });
  ok('it is still there while the Death plays', !!(await crObj()));
  await p.waitForTimeout(900);
  ok('and gone when it is over', !(await crObj()) && !(await kind('creature')));
  await build();

  console.log('');
  console.log('== a fresh creature holds still and touches nothing until its hitbox is drawn ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('creature'); window.__pg.setFlying(false); window.__pg.paused(false); });   // the world runs while it is drawn on
  await standAt(X-200, Y+60);
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+100, Y-60]);       // in the air, near the player
  await p.waitForTimeout(200);
  let fc = await kind('creature');
  let fo = (await stats()).filter(o => o.id === fc.obj)[0];
  ok('placed: no collision and held still, in the air where it was put', fc.ghost === true && fo.static === true && fo.sensor === true && Math.abs(fo.pos.y - (Y-60)) < 2, { ghost: fc.ghost, static: fo.static, sensor: fo.sensor, y: fo.pos.y });
  ok('the studio opens on its Size step first', (await st('where')).state === 'size', (await st('where')).state);
  const szr = await st('size', 200, 100);
  fo = (await stats()).filter(o => o.id === fc.obj)[0];
  ok('width and height set the space it is drawn in, and its body with it', szr.w === 200 && szr.h === 100 && Math.abs(fo.area - 200*100) < 200, { size: szr, area: fo.area });
  const nxS = await p.evaluate(() => Array.from(document.querySelectorAll('#ceLeft button')).map(b => b.textContent).find(t => /^Next:/.test(t)));
  ok('Next goes on to the look', /Idle/.test(nxS || ''), nxS);
  await st('click', nxS); await p.waitForTimeout(150);
  ok('and the drawing box takes that shape', Math.abs((await st('canvasRect')).w / (await st('canvasRect')).h - 2) < 0.05, (await st('canvasRect')));
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 150, range: 900 }), fc.id);
  await st('setColor', '#C89BD9'); await stroke(0.2, 0.3, 0.8, 0.7);
  await p.waitForTimeout(700);
  fo = (await stats()).filter(o => o.id === fc.obj)[0];
  ok('while it is drawn on it neither falls nor walks after the player', Math.abs(fo.pos.x - (X+100)) < 2 && Math.abs(fo.pos.y - (Y-60)) < 2, fo.pos);
  await st('go', 'hitbox', 0);
  await st('click', '✨ Use my drawing as the hitbox'); await p.waitForTimeout(100);
  const copied = await st('drawing');
  ok('Use my drawing copies the look onto the hitbox step, in the hitbox colour', copied.length === 1 && copied[0].c === '#4FA9D6', copied);
  await st('click', 'Clear');
  await stroke(0.5, 0.2, 0.5, 0.8);
  ok('a hitbox stroke lands on the step', (await st('drawing')).length === 1);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  ok('and Ctrl+Z takes it back off the step', (await st('drawing')).length === 0, await st('drawing'));
  await p.keyboard.press('Control+y'); await p.waitForTimeout(80);
  ok('Ctrl+Y puts it back', (await st('drawing')).length === 1);
  await st('close'); await p.waitForTimeout(150);
  fc = await kind('creature');
  fo = (await stats()).filter(o => o.id === fc.obj)[0];
  ok('closing with a hitbox drawn makes it solid and lets it go', fc.ghost === false && fo.static === false && fo.sensor === false, { ghost: fc.ghost, static: fo.static, sensor: fo.sensor });
  const mk = await p.evaluate(id => { const g = window.__pg.gadgets().find(g => g.id === id); const o = window.__pg.stats().find(o => o.id === g.obj); return { g: [g.x, g.y], body: o.pos }; }, fc.id);   // read together: it is moving
  ok('and the creature marker sits in the middle of the drawn hitbox', Math.abs(mk.g[0] - mk.body.x) < 2 && Math.abs(mk.g[1] - mk.body.y) < 2, mk);
  await p.waitForTimeout(700);
  fo = (await stats()).filter(o => o.id === fc.obj)[0];
  ok('now it falls and comes after the player', fo.pos.y > Y - 30 && fo.pos.x < X + 60, fo.pos);
  ok('standing up straight, whatever happened on the way', Math.abs(fo.angle) < 0.02, fo.angle);
  await p.evaluate(id => window.__pg.skinStudioAt(id, 'size'), fc.id); await p.waitForTimeout(200);
  const areaBefore = (await stats()).filter(o => o.id === fc.obj)[0].area;
  await st('size', 400, 200);
  const areaAfter = (await stats()).filter(o => o.id === fc.obj)[0].area;
  ok('changing the size later scales the drawn hitbox with it', Math.abs(areaAfter / areaBefore - 4) < 0.3, { before: areaBefore, after: areaAfter });
  await st('close'); await p.waitForTimeout(150);
  await p.evaluate(() => { window.__pg.paused(true); window.__pg.setFlying(true); });

  console.log('');
  console.log('== the tool places a creature whatever paint shape is picked; the marker moves the whole thing ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setPaintMode('rect'); window.__pg.setLayer(1); window.__pg.setTool('creature'); });
  const cs0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+100, Y-40]);
  await p.mouse.move(cs0.x, cs0.y); await p.mouse.down(); await p.mouse.move(cs0.x + 60, cs0.y + 40, { steps: 4 }); await p.mouse.up();
  await p.waitForTimeout(250);
  const mc = await kind('creature');
  const objsNow = await stats();
  ok('a press in the drag-out box mode still places a creature, not a green box of material', !!mc && objsNow.filter(o => o.pieces.some(pc => /^creature/.test(pc))).length === 1, { creature: !!mc, n: objsNow.length });
  ok('and opens the studio for it', !(await p.evaluate(() => document.getElementById('charEditorOverlay').hidden)));
  await st('setColor', '#C89BD9'); await stroke(0.2, 0.3, 0.8, 0.7);
  await st('go', 'hitbox', 0); await stroke(0.3, 0.3, 0.7, 0.7);
  await st('close'); await p.waitForTimeout(200);
  await p.evaluate(() => { window.__pg.setPaintMode('brush'); window.__pg.setTool('move'); window.__pg.deselect(); });
  const before = await p.evaluate(id => { const g = window.__pg.gadgets().find(g => g.id === id); const o = window.__pg.stats().find(o => o.id === g.obj); return { g: [g.x, g.y], body: o.pos, obj: g.obj }; }, mc.id);
  const ms = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [before.g[0], before.g[1]]);
  await p.mouse.move(ms.x, ms.y); await p.mouse.down(); await p.mouse.move(ms.x + 60, ms.y - 30, { steps: 6 }); await p.mouse.move(ms.x + 150, ms.y - 60, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(200);
  const after = await p.evaluate(id => { const g = window.__pg.gadgets().find(g => g.id === id); const o = window.__pg.stats().find(o => o.id === g.obj); return { g: [g.x, g.y], body: o.pos, obj: g.obj }; }, mc.id);
  ok('dragging the marker moves the creature, body and all', after.obj === before.obj && after.body.x > before.body.x + 100 && after.body.y < before.body.y - 30, { before, after });
  ok('with the marker still on it', Math.abs(after.g[0] - after.body.x) < 2 && Math.abs(after.g[1] - after.body.y) < 2, after);
  // a level saved before the body materials were renamed still loads whole
  const svOld = await p.evaluate(() => window.__pg.serialize('old names'));
  svOld.objects.forEach(o => o.pieces.forEach(pc => { if (pc.m === 'creaturebody') pc.m = 'creature'; if (pc.m === 'drawnbody') pc.m = 'drawn'; }));
  await p.evaluate(d => window.__pg.load(d), svOld); await p.waitForTimeout(300);
  const ld = await p.evaluate(() => ({ pieces: window.__pg.stats().map(o => o.pieces[0]), g: window.__pg.gadgets().find(g => g.kind === 'creature') }));
  ok('a save with the old body names loads with its creature body and marker intact', ld.pieces.some(pc => /^creaturebody/.test(pc)) && ld.g && ld.g.obj, ld);

  console.log('');
  console.log('== an empty hitbox means no collision; a creature on the Back layer ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(0); window.__pg.setTool('creature'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+100, Y+40]);
  await p.waitForTimeout(200);
  await st('setColor', '#C89BD9'); await stroke(0.2, 0.3, 0.8, 0.7);
  await st('close'); await p.waitForTimeout(300);
  const bc = await kind('creature');
  ok('a creature can be put on the Back layer', bc && bc.layer === 0, bc && bc.layer);
  ok('with nothing drawn for a hitbox it has no collision', bc.ghost === true, bc.ghost);
  await p.evaluate(id => window.__pg.gadgetSet(id, { speed: 150, range: 600 }), bc.id);
  await play();
  const b0 = await crObj();
  await standAt(X-250, Y+60); await p.waitForTimeout(700);
  ok('and floats after the player there', (await crObj()).pos.x < b0.pos.x - 40);
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
  const emRect = await st('canvasRect');
  ok('its studio opens on a square box', opened && Math.abs(emRect.w / emRect.h - 1) < 0.05, emRect);
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
  ok('the save carries the particle drawing and its settings', ge && ge.skin && ge.skin.states.particle[0].length === 1 && ge.rate === 40 && ge.life === 0.5 && ge.alpha === 1, ge && { rate: ge.rate, life: ge.life, alpha: ge.alpha });
  await p.evaluate(id => window.__pg.gadgetSet(id, { alpha: 0.4 }), (await kind('emitter')).id);
  ok('particles have an opacity', (await kind('emitter')).alpha === 0.4);

  console.log('');
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
